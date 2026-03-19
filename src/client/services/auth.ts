import {
	base64urlToBytes,
	clearStoredKey,
	deriveKeyFromPassword,
	getStoredKey,
	storeKey,
	unwrapKeyWithPRF,
	wrapKeyWithPRF,
} from "@client/crypto/encryption";
import { api, clearToken, setToken } from "@client/services/api";

// Thrown when passkey auth succeeds with PRF but no wrapped key is stored yet.
// The UI should prompt for password once to link the encryption key to this passkey.
export class PasskeyNeedsPRFSetup extends Error {
	readonly name = "PasskeyNeedsPRFSetup";
	constructor(
		public readonly username: string,
		public readonly passkeyId: string,
		public readonly prfBytes: Uint8Array,
	) {
		super("First passkey login with PRF — enter password once to link");
	}
}

// Thrown when passkey auth succeeds but the authenticator does not support PRF.
// The UI should prompt for password to derive the encryption key directly.
export class PasskeyPRFUnavailable extends Error {
	readonly name = "PasskeyPRFUnavailable";
	constructor(public readonly username: string) {
		super("PRF not supported — enter password to decrypt data");
	}
}

export async function register(
	username: string,
	password: string,
): Promise<void> {
	const result = await api.auth.register(username, password);
	setToken(result.token);
	const encryptionKey = await deriveKeyFromPassword(password, username);
	storeKey(encryptionKey);
}

export async function login(username: string, password: string): Promise<void> {
	const result = await api.auth.login(username, password);
	setToken(result.token);
	const encryptionKey = await deriveKeyFromPassword(password, username);
	storeKey(encryptionKey);
}

// Attempt passkey login with PRF-based key derivation.
// Throws PasskeyNeedsPRFSetup or PasskeyPRFUnavailable if extra steps are needed.
export async function loginWithPasskey(): Promise<void> {
	const { startAuthentication } = await import("@simplewebauthn/browser");
	const options = await api.passkeys.getAuthenticationOptions();
	const authResponse = await startAuthentication({ optionsJSON: options });
	const result = await api.passkeys.verifyAuthentication(
		authResponse,
		options.challenge,
	);
	setToken(result.token);

	// Extract PRF result from client-side extension outputs (server never sees this value)
	const prfFirst = (
		authResponse.clientExtensionResults as {
			prf?: { results?: { first?: string } };
		}
	)?.prf?.results?.first;

	if (!prfFirst) {
		// Authenticator doesn't support PRF — fall back to password-based key derivation
		throw new PasskeyPRFUnavailable(result.username);
	}

	const prfBytes = base64urlToBytes(prfFirst);

	if (result.prfWrappedKey && result.prfIv) {
		// Happy path: unwrap the stored encryption key using the PRF output
		const encKey = await unwrapKeyWithPRF(
			prfBytes,
			result.prfWrappedKey,
			result.prfIv,
		);
		storeKey(encKey);
	} else {
		// PRF works but no wrapped key stored yet (first passkey login after adding passkey)
		throw new PasskeyNeedsPRFSetup(result.username, result.passkeyId, prfBytes);
	}
}

// Called after PasskeyNeedsPRFSetup: derives the encryption key from password,
// wraps it with the PRF output, and stores the wrapped key server-side.
// After this, future passkey logins are seamless (no password needed).
export async function completePasskeyPRFSetup(
	username: string,
	password: string,
	passkeyId: string,
	prfBytes: Uint8Array,
): Promise<void> {
	const encKey = await deriveKeyFromPassword(password, username);
	const { wrappedKey, iv } = await wrapKeyWithPRF(encKey, prfBytes);
	await api.passkeys.storePRFKey(passkeyId, wrappedKey, iv);
	storeKey(encKey);
}

// Called after PasskeyPRFUnavailable: derives the encryption key from password.
// Auth is already complete (JWT is set); this just unlocks the data.
export async function completePasskeyWithPassword(
	username: string,
	password: string,
): Promise<void> {
	const encKey = await deriveKeyFromPassword(password, username);
	storeKey(encKey);
}

export async function registerPasskey(): Promise<void> {
	const { startRegistration } = await import("@simplewebauthn/browser");
	const options = await api.passkeys.getRegistrationOptions();
	const regResponse = await startRegistration({ optionsJSON: options });
	await api.passkeys.verifyRegistration(regResponse, options.challenge);
}

export function logout(): void {
	clearToken();
	clearStoredKey();
}

export function isLoggedIn(): boolean {
	return !!sessionStorage.getItem("lavendar_token");
}

export function hasEncryptionKey(): boolean {
	return !!getStoredKey();
}
