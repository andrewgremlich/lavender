import {
	generateAuthenticationOptions,
	generateRegistrationOptions,
	verifyAuthenticationResponse,
	verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { Hono } from "hono";
import { sign } from "hono/jwt";
import { generateId } from "../crypto.js";
import { authMiddleware, getUserId } from "../middleware/auth.js";
import type { Env, PasskeyRow, UserRow } from "../types.js";

const passkeys = new Hono<{ Bindings: Env }>();

// PRF evaluation input — fixed app-specific salt.
// Must be consistent across all calls so the authenticator always returns
// the same 32-byte output for a given credential.
function prfEvalInput(): string {
	const bytes = new TextEncoder().encode("lavendar-v1-encryption-key");
	return btoa(String.fromCharCode(...bytes))
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=/g, "");
}

// Registration options (requires auth - user adds passkey to existing account)
passkeys.post("/register/options", authMiddleware(), async (c) => {
	const userId = getUserId(c);

	const user = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?")
		.bind(userId)
		.first<UserRow>();

	if (!user) {
		return c.json({ error: "User not found" }, 404);
	}

	const existingCredentials = await c.env.DB.prepare(
		"SELECT credential_id, transports FROM passkey_credentials WHERE user_id = ?",
	)
		.bind(userId)
		.all<PasskeyRow>();

	const options = await generateRegistrationOptions({
		rpName: c.env.WEBAUTHN_RP_NAME || "Lavendar",
		rpID: c.env.WEBAUTHN_RP_ID || "localhost",
		userID: new TextEncoder().encode(userId),
		userName: user.username,
		attestationType: "none",
		excludeCredentials: (existingCredentials.results || []).map((cred) => ({
			id: cred.credential_id,
			transports: cred.transports ? JSON.parse(cred.transports) : undefined,
		})),
		authenticatorSelection: {
			residentKey: "preferred",
			userVerification: "preferred",
		},
		// Request PRF extension at registration to check support
		extensions: { prf: { eval: { first: prfEvalInput() } } } as Record<
			string,
			unknown
		>,
	});

	return c.json(options);
});

// Verify registration
passkeys.post("/register/verify", authMiddleware(), async (c) => {
	const userId = getUserId(c);
	const { response, challenge } = await c.req.json();

	const verification = await verifyRegistrationResponse({
		response,
		expectedChallenge: challenge,
		expectedOrigin: c.env.WEBAUTHN_ORIGIN || "http://localhost:8787",
		expectedRPID: c.env.WEBAUTHN_RP_ID || "localhost",
	});

	if (!verification.verified || !verification.registrationInfo) {
		return c.json({ error: "Verification failed" }, 400);
	}

	const { credential } = verification.registrationInfo;

	await c.env.DB.prepare(
		"INSERT INTO passkey_credentials (id, user_id, credential_id, public_key, counter, transports) VALUES (?, ?, ?, ?, ?, ?)",
	)
		.bind(
			generateId(),
			userId,
			credential.id,
			btoa(String.fromCharCode(...credential.publicKey)),
			credential.counter,
			JSON.stringify(response.response.transports || []),
		)
		.run();

	return c.json({ verified: true });
});

// Authentication options (no auth required - this is for login)
passkeys.post("/authenticate/options", async (c) => {
	const options = await generateAuthenticationOptions({
		rpID: c.env.WEBAUTHN_RP_ID || "localhost",
		userVerification: "preferred",
		// Request PRF evaluation — browser will evaluate if the authenticator supports it
		extensions: { prf: { eval: { first: prfEvalInput() } } } as Record<
			string,
			unknown
		>,
	});

	return c.json(options);
});

// Verify authentication
passkeys.post("/authenticate/verify", async (c) => {
	const { response, challenge } = await c.req.json();

	const credentialId = response.id;
	const credential = await c.env.DB.prepare(
		"SELECT * FROM passkey_credentials WHERE credential_id = ?",
	)
		.bind(credentialId)
		.first<PasskeyRow>();

	if (!credential) {
		return c.json({ error: "Credential not found" }, 404);
	}

	const publicKeyBytes = Uint8Array.from(atob(credential.public_key), (c) =>
		c.charCodeAt(0),
	);

	const verification = await verifyAuthenticationResponse({
		response,
		expectedChallenge: challenge,
		expectedOrigin: c.env.WEBAUTHN_ORIGIN || "http://localhost:8787",
		expectedRPID: c.env.WEBAUTHN_RP_ID || "localhost",
		credential: {
			id: credential.credential_id,
			publicKey: publicKeyBytes,
			counter: credential.counter,
			transports: credential.transports
				? JSON.parse(credential.transports)
				: undefined,
		},
	});

	if (!verification.verified) {
		return c.json({ error: "Authentication failed" }, 401);
	}

	// Update counter
	await c.env.DB.prepare(
		"UPDATE passkey_credentials SET counter = ? WHERE id = ?",
	)
		.bind(verification.authenticationInfo.newCounter, credential.id)
		.run();

	// Get user for token
	const user = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?")
		.bind(credential.user_id)
		.first<UserRow>();

	if (!user) {
		return c.json({ error: "User not found" }, 404);
	}

	const token = await sign(
		{ sub: user.id, username: user.username },
		c.env.JWT_SECRET,
	);

	// Return the passkey's PRF-wrapped encryption key if one has been stored
	return c.json({
		token,
		username: user.username,
		passkeyId: credential.id,
		prfWrappedKey: credential.prf_wrapped_key,
		prfIv: credential.prf_iv,
	});
});

// Store PRF-wrapped encryption key for a passkey (called once after first PRF login)
passkeys.put("/:id/prf-key", authMiddleware(), async (c) => {
	const userId = getUserId(c);
	const passkeyId = c.req.param("id");
	const { prfWrappedKey, prfIv } = await c.req.json<{
		prfWrappedKey: string;
		prfIv: string;
	}>();

	if (!prfWrappedKey || !prfIv) {
		return c.json({ error: "prfWrappedKey and prfIv are required" }, 400);
	}

	const result = await c.env.DB.prepare(
		"UPDATE passkey_credentials SET prf_wrapped_key = ?, prf_iv = ? WHERE id = ? AND user_id = ?",
	)
		.bind(prfWrappedKey, prfIv, passkeyId, userId)
		.run();

	if (result.meta.changes === 0) {
		return c.json({ error: "Passkey not found" }, 404);
	}

	return c.json({ ok: true });
});

// List user's passkeys (authenticated)
passkeys.get("/", authMiddleware(), async (c) => {
	const userId = getUserId(c);

	const rows = await c.env.DB.prepare(
		"SELECT id, credential_id, created_at FROM passkey_credentials WHERE user_id = ?",
	)
		.bind(userId)
		.all<PasskeyRow>();

	return c.json(rows.results || []);
});

// Delete a passkey
passkeys.delete("/:id", authMiddleware(), async (c) => {
	const userId = getUserId(c);
	const passkeyId = c.req.param("id");

	await c.env.DB.prepare(
		"DELETE FROM passkey_credentials WHERE id = ? AND user_id = ?",
	)
		.bind(passkeyId, userId)
		.run();

	return c.json({ message: "Passkey deleted" });
});

export { passkeys };
