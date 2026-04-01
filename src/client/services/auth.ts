import {
	clearStoredKey,
	decrypt,
	deriveKeyFromPassword,
	deriveLegacyKey,
	encrypt,
	generateClientSalt,
	generateRecoveryCode,
	getStoredKey,
	hashWithSalt,
	importKey,
	storeKey,
	storeLegacyKey,
	unwrapEncryptionKey,
	wrapEncryptionKey,
} from "@client/crypto/encryption";
import { api, clearToken, setToken } from "@client/services/api";

/**
 * Register a new user. Derives an encryption key, generates a recovery code,
 * wraps the key with it, and stores everything server-side.
 * Returns the recovery code — the caller MUST show it to the user.
 */
export async function register(
	username: string,
	password: string,
): Promise<string> {
	const encryptionKey = await deriveKeyFromPassword(password, username);
	const recoveryCode = generateRecoveryCode();
	const { wrapped, iv } = await wrapEncryptionKey(encryptionKey, recoveryCode);
	const recoverySalt = generateClientSalt();
	const recoveryCodeHash = await hashWithSalt(recoveryCode, recoverySalt);

	const result = await api.auth.register(username, password, {
		wrappedEncryptionKey: wrapped,
		wrappedEncryptionKeyIv: iv,
		recoveryCodeHash,
		recoveryCodeSalt: recoverySalt,
	});
	setToken(result.token);
	storeKey(encryptionKey);
	return recoveryCode;
}

/**
 * Log in. Returns whether the account already has a recovery code set up.
 * If false, the caller should prompt the user to set one up.
 */
export async function login(
	username: string,
	password: string,
): Promise<boolean> {
	const result = await api.auth.login(username, password);
	setToken(result.token);
	const encryptionKey = await deriveKeyFromPassword(password, username);
	storeKey(encryptionKey);
	const legacyKey = await deriveLegacyKey(password, username);
	storeLegacyKey(legacyKey);
	return result.hasRecovery;
}

/**
 * Set up a recovery code for an already-logged-in user (existing accounts without one).
 * Wraps the current session encryption key with a new recovery code.
 * Returns the recovery code — the caller MUST show it to the user.
 */
export async function setupRecovery(): Promise<string> {
	const encKeyBase64 = getStoredKey();
	if (!encKeyBase64) throw new Error("No encryption key in session");

	const recoveryCode = generateRecoveryCode();
	const { wrapped, iv } = await wrapEncryptionKey(encKeyBase64, recoveryCode);
	const recoverySalt = generateClientSalt();
	const recoveryCodeHash = await hashWithSalt(recoveryCode, recoverySalt);

	await api.auth.recoverySetup({
		wrappedEncryptionKey: wrapped,
		wrappedEncryptionKeyIv: iv,
		recoveryCodeHash,
		recoveryCodeSalt: recoverySalt,
	});

	return recoveryCode;
}

/**
 * Complete password recovery using a recovery code.
 * Re-encrypts all existing entries with the new password's key,
 * rotates the recovery code, and returns the new recovery code.
 * The caller MUST show the new recovery code to the user before navigating away.
 */
export async function recover(
	username: string,
	recoveryCode: string,
	newPassword: string,
): Promise<string> {
	// Normalize: strip spaces and dashes (user may paste with formatting)
	const normalized = recoveryCode.replace(/[\s-]/g, "").toUpperCase();
	const formatted = `${normalized.slice(0, 8)}-${normalized.slice(8, 16)}-${normalized.slice(16, 24)}-${normalized.slice(24, 32)}`;

	// 1. Verify recovery code server-side and fetch wrapped key + entries
	const { wrappedEncryptionKey, wrappedEncryptionKeyIv, entries } =
		await api.auth.recoveryStart(formatted, username);

	// 2. Unwrap the old encryption key client-side using the recovery code
	const oldEncKeyBase64 = await unwrapEncryptionKey(
		wrappedEncryptionKey,
		wrappedEncryptionKeyIv,
		formatted,
	);

	// 3. Derive the new encryption key from the new password
	const newEncKeyBase64 = await deriveKeyFromPassword(newPassword, username);

	// 4. Re-encrypt all entries
	const oldKey = await importKey(oldEncKeyBase64);
	const newKey = await importKey(newEncKeyBase64);
	const reEncryptedEntries = await Promise.all(
		entries.map(async (e) => {
			const plaintext = await decrypt(e.encryptedData, e.iv, oldKey);
			const { encrypted, iv } = await encrypt(plaintext, newKey);
			return { id: e.id, encryptedData: encrypted, iv };
		}),
	);

	// 5. Generate a new (rotated) recovery code and wrap the new enc key with it
	const newRecoveryCode = generateRecoveryCode();
	const { wrapped: newWrapped, iv: newWrappedIv } = await wrapEncryptionKey(
		newEncKeyBase64,
		newRecoveryCode,
	);
	const newRecoverySalt = generateClientSalt();
	const newRecoveryCodeHash = await hashWithSalt(
		newRecoveryCode,
		newRecoverySalt,
	);

	// 6. Submit the recovery to the server (atomic update of password + entries + new recovery code)
	const result = await api.auth.recover({
		username,
		recoveryCode: formatted,
		newPassword,
		reEncryptedEntries,
		newWrappedEncryptionKey: newWrapped,
		newWrappedEncryptionKeyIv: newWrappedIv,
		newRecoveryCodeHash,
		newRecoveryCodeSalt: newRecoverySalt,
	});

	setToken(result.token);
	storeKey(newEncKeyBase64);
	const legacyKey = await deriveLegacyKey(newPassword, username);
	storeLegacyKey(legacyKey);

	return newRecoveryCode;
}

export function logout(): void {
	clearToken();
	clearStoredKey();
}

export function isLoggedIn(): boolean {
	return !!sessionStorage.getItem("lavender_token");
}

export function hasEncryptionKey(): boolean {
	return !!getStoredKey();
}
