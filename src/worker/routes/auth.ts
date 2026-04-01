import { Hono } from "hono";
import { sign } from "hono/jwt";
import {
	generateId,
	generateSalt,
	hashPassword,
	timingSafeEqual,
} from "../crypto.js";
import { authMiddleware, getUserId } from "../middleware/auth.js";
import { rateLimiter } from "../middleware/rate-limit.js";
import type { Env, UserRow } from "../types.js";

const auth = new Hono<{ Bindings: Env }>();

// Rate limit all auth endpoints
auth.use("/*", rateLimiter());

auth.post("/register", async (c) => {
	const {
		username,
		password,
		wrappedEncryptionKey,
		wrappedEncryptionKeyIv,
		recoveryCodeHash,
		recoveryCodeSalt,
	} = await c.req.json<{
		username: string;
		password: string;
		wrappedEncryptionKey?: string;
		wrappedEncryptionKeyIv?: string;
		recoveryCodeHash?: string;
		recoveryCodeSalt?: string;
	}>();

	if (!username || !password) {
		return c.json({ error: "Username and password required" }, 400);
	}
	if (username.length < 3 || username.length > 50) {
		return c.json({ error: "Username must be 3-50 characters" }, 400);
	}
	if (password.length < 12) {
		return c.json({ error: "Password must be at least 12 characters" }, 400);
	}
	if (!/\d/.test(password)) {
		return c.json({ error: "Password must contain at least one number" }, 400);
	}
	if (!/[^a-zA-Z0-9]/.test(password)) {
		return c.json(
			{ error: "Password must contain at least one special character" },
			400,
		);
	}

	const existing = await c.env.lavender_db
		.prepare("SELECT id FROM users WHERE username = ?")
		.bind(username)
		.first();
	if (existing) {
		return c.json({ error: "Username already taken" }, 409);
	}

	const id = generateId();
	const salt = generateSalt();
	const passwordHash = await hashPassword(password, salt);

	const hasRecovery = !!(
		wrappedEncryptionKey &&
		wrappedEncryptionKeyIv &&
		recoveryCodeHash &&
		recoveryCodeSalt
	);

	await c.env.lavender_db
		.prepare(
			`INSERT INTO users (id, username, password_hash, salt, recovery_code_hash, recovery_code_salt, wrapped_encryption_key, wrapped_encryption_key_iv)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		)
		.bind(
			id,
			username,
			passwordHash,
			salt,
			recoveryCodeHash ?? null,
			recoveryCodeSalt ?? null,
			wrappedEncryptionKey ?? null,
			wrappedEncryptionKeyIv ?? null,
		)
		.run();

	// Create default settings
	await c.env.lavender_db
		.prepare("INSERT INTO user_settings (user_id) VALUES (?)")
		.bind(id)
		.run();

	const token = await sign(
		{ sub: id, username, exp: Math.floor(Date.now() / 1000) + 86400 },
		c.env.JWT_SECRET,
	);
	return c.json({ token, username, hasRecovery }, 201);
});

auth.post("/login", async (c) => {
	const { username, password } = await c.req.json<{
		username: string;
		password: string;
	}>();

	if (!username || !password) {
		return c.json({ error: "Username and password required" }, 400);
	}

	const user = await c.env.lavender_db
		.prepare("SELECT * FROM users WHERE username = ?")
		.bind(username)
		.first<UserRow>();

	if (!user) {
		return c.json({ error: "Invalid credentials" }, 401);
	}

	const passwordHash = await hashPassword(password, user.salt);
	if (!timingSafeEqual(passwordHash, user.password_hash)) {
		return c.json({ error: "Invalid credentials" }, 401);
	}

	const hasRecovery = !!(
		user.wrapped_encryption_key && user.recovery_code_hash
	);

	const token = await sign(
		{ sub: user.id, username, exp: Math.floor(Date.now() / 1000) + 86400 },
		c.env.JWT_SECRET,
	);
	return c.json({ token, username, hasRecovery });
});

auth.put("/password", authMiddleware(), async (c) => {
	const userId = getUserId(c);
	const { oldPassword, newPassword, reEncryptedEntries } = await c.req.json<{
		oldPassword: string;
		newPassword: string;
		reEncryptedEntries: Array<{
			id: string;
			encryptedData: string;
			iv: string;
		}>;
	}>();

	if (!oldPassword || !newPassword) {
		return c.json({ error: "Old and new passwords required" }, 400);
	}
	if (newPassword.length < 12) {
		return c.json({ error: "Password must be at least 12 characters" }, 400);
	}
	if (!/\d/.test(newPassword)) {
		return c.json({ error: "Password must contain at least one number" }, 400);
	}
	if (!/[^a-zA-Z0-9]/.test(newPassword)) {
		return c.json(
			{ error: "Password must contain at least one special character" },
			400,
		);
	}

	const user = await c.env.lavender_db
		.prepare("SELECT * FROM users WHERE id = ?")
		.bind(userId)
		.first<UserRow>();

	if (!user) {
		return c.json({ error: "Invalid credentials" }, 401);
	}

	const oldHash = await hashPassword(oldPassword, user.salt);
	if (!timingSafeEqual(oldHash, user.password_hash)) {
		return c.json({ error: "Current password is incorrect" }, 401);
	}

	const newSalt = generateSalt();
	const newHash = await hashPassword(newPassword, newSalt);

	// Update password and re-encrypted entries atomically in a batch
	const statements = [
		c.env.lavender_db
			.prepare("UPDATE users SET password_hash = ?, salt = ? WHERE id = ?")
			.bind(newHash, newSalt, userId),
	];

	if (reEncryptedEntries?.length) {
		for (const entry of reEncryptedEntries) {
			statements.push(
				c.env.lavender_db
					.prepare(
						"UPDATE health_entries SET encrypted_data = ?, iv = ? WHERE id = ? AND user_id = ?",
					)
					.bind(entry.encryptedData, entry.iv, entry.id, userId),
			);
		}
	}

	await c.env.lavender_db.batch(statements);

	// Return new token so the client stays authenticated
	const token = await sign(
		{
			sub: user.id,
			username: user.username,
			exp: Math.floor(Date.now() / 1000) + 86400,
		},
		c.env.JWT_SECRET,
	);
	return c.json({
		token,
		username: user.username,
		hasRecovery: !!(user.wrapped_encryption_key && user.recovery_code_hash),
	});
});

/** POST /api/auth/recovery-setup — store a recovery code for an existing user (JWT required). */
auth.post("/recovery-setup", authMiddleware(), async (c) => {
	const userId = getUserId(c);
	const {
		wrappedEncryptionKey,
		wrappedEncryptionKeyIv,
		recoveryCodeHash,
		recoveryCodeSalt,
	} = await c.req.json<{
		wrappedEncryptionKey: string;
		wrappedEncryptionKeyIv: string;
		recoveryCodeHash: string;
		recoveryCodeSalt: string;
	}>();

	if (
		!wrappedEncryptionKey ||
		!wrappedEncryptionKeyIv ||
		!recoveryCodeHash ||
		!recoveryCodeSalt
	) {
		return c.json({ error: "All recovery fields required" }, 400);
	}

	await c.env.lavender_db
		.prepare(
			`UPDATE users SET wrapped_encryption_key = ?, wrapped_encryption_key_iv = ?,
       recovery_code_hash = ?, recovery_code_salt = ? WHERE id = ?`,
		)
		.bind(
			wrappedEncryptionKey,
			wrappedEncryptionKeyIv,
			recoveryCodeHash,
			recoveryCodeSalt,
			userId,
		)
		.run();

	return c.json({ message: "Recovery code saved" });
});

/**
 * POST /api/auth/recovery-start — verify recovery code and return wrapped key + entries.
 * No JWT required; authenticated by the recovery code (hashed server-side against stored hash).
 */
auth.post("/recovery-start", async (c) => {
	const { username, recoveryCode } = await c.req.json<{
		username: string;
		recoveryCode: string;
	}>();

	if (!username || !recoveryCode) {
		return c.json({ error: "Username and recovery code required" }, 400);
	}

	const user = await c.env.lavender_db
		.prepare("SELECT * FROM users WHERE username = ?")
		.bind(username)
		.first<UserRow>();

	if (
		!user ||
		!user.recovery_code_hash ||
		!user.recovery_code_salt ||
		!user.wrapped_encryption_key ||
		!user.wrapped_encryption_key_iv
	) {
		return c.json({ error: "No recovery code found for this account" }, 404);
	}

	// Hash the supplied code with the stored salt and compare (same pattern as password login)
	const suppliedHash = await hashPassword(
		recoveryCode,
		user.recovery_code_salt,
	);
	if (!timingSafeEqual(suppliedHash, user.recovery_code_hash)) {
		return c.json({ error: "Invalid recovery code" }, 401);
	}

	const entries = await c.env.lavender_db
		.prepare(
			"SELECT id, encrypted_data, iv FROM health_entries WHERE user_id = ?",
		)
		.bind(user.id)
		.all<{ id: string; encrypted_data: string; iv: string }>();

	const mappedEntries = (entries.results ?? []).map((e) => ({
		id: e.id,
		encryptedData: e.encrypted_data,
		iv: e.iv,
	}));

	return c.json({
		wrappedEncryptionKey: user.wrapped_encryption_key,
		wrappedEncryptionKeyIv: user.wrapped_encryption_key_iv,
		entries: mappedEntries,
	});
});

/**
 * POST /api/auth/recover — complete password recovery.
 * Verifies recovery code, atomically updates password + all entries + rotated recovery code.
 */
auth.post("/recover", async (c) => {
	const {
		username,
		recoveryCode,
		newPassword,
		reEncryptedEntries,
		newWrappedEncryptionKey,
		newWrappedEncryptionKeyIv,
		newRecoveryCodeHash,
		newRecoveryCodeSalt,
	} = await c.req.json<{
		username: string;
		recoveryCode: string;
		newPassword: string;
		reEncryptedEntries: Array<{
			id: string;
			encryptedData: string;
			iv: string;
		}>;
		newWrappedEncryptionKey: string;
		newWrappedEncryptionKeyIv: string;
		newRecoveryCodeHash: string;
		newRecoveryCodeSalt: string;
	}>();

	if (!username || !recoveryCode || !newPassword) {
		return c.json({ error: "All fields required" }, 400);
	}
	if (newPassword.length < 12) {
		return c.json({ error: "Password must be at least 12 characters" }, 400);
	}
	if (!/\d/.test(newPassword)) {
		return c.json({ error: "Password must contain at least one number" }, 400);
	}
	if (!/[^a-zA-Z0-9]/.test(newPassword)) {
		return c.json(
			{ error: "Password must contain at least one special character" },
			400,
		);
	}

	const user = await c.env.lavender_db
		.prepare("SELECT * FROM users WHERE username = ?")
		.bind(username)
		.first<UserRow>();

	if (!user || !user.recovery_code_hash || !user.recovery_code_salt) {
		return c.json({ error: "No recovery code found for this account" }, 404);
	}

	// Hash the supplied code with the stored salt and compare (same pattern as password login)
	const suppliedHash = await hashPassword(
		recoveryCode,
		user.recovery_code_salt,
	);
	if (!timingSafeEqual(suppliedHash, user.recovery_code_hash)) {
		return c.json({ error: "Invalid recovery code" }, 401);
	}

	const newSalt = generateSalt();
	const newHash = await hashPassword(newPassword, newSalt);

	// Atomically update: password, rotated recovery fields, and all re-encrypted entries
	const statements = [
		c.env.lavender_db
			.prepare(
				`UPDATE users SET password_hash = ?, salt = ?,
         wrapped_encryption_key = ?, wrapped_encryption_key_iv = ?,
         recovery_code_hash = ?, recovery_code_salt = ?
         WHERE id = ?`,
			)
			.bind(
				newHash,
				newSalt,
				newWrappedEncryptionKey,
				newWrappedEncryptionKeyIv,
				newRecoveryCodeHash,
				newRecoveryCodeSalt,
				user.id,
			),
	];

	if (reEncryptedEntries?.length) {
		for (const entry of reEncryptedEntries) {
			statements.push(
				c.env.lavender_db
					.prepare(
						"UPDATE health_entries SET encrypted_data = ?, iv = ? WHERE id = ? AND user_id = ?",
					)
					.bind(entry.encryptedData, entry.iv, entry.id, user.id),
			);
		}
	}

	await c.env.lavender_db.batch(statements);

	const token = await sign(
		{
			sub: user.id,
			username: user.username,
			exp: Math.floor(Date.now() / 1000) + 86400,
		},
		c.env.JWT_SECRET,
	);
	return c.json({ token, username: user.username, hasRecovery: true });
});

auth.delete("/account", authMiddleware(), async (c) => {
	const userId = getUserId(c);

	// CASCADE will handle related records
	await c.env.lavender_db
		.prepare("DELETE FROM users WHERE id = ?")
		.bind(userId)
		.run();

	return c.json({ message: "Account deleted" });
});

export { auth };
