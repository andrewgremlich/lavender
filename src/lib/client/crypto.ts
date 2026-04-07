// Client-side AES-256-GCM encryption and PBKDF2 key derivation.
// Direct port from legacy/src/client/crypto/encryption.ts.
//
// Design: the encryption key is derived from the user's password via PBKDF2
// and lives only in sessionStorage (cleared on tab close). The server never
// sees plaintext data. A legacy PBKDF2 salt prefix (`lavendar`, typo preserved)
// is retained for backward compatibility with existing accounts.

const ALGO = 'AES-GCM';
const KEY_LENGTH = 256;
const LEGACY_SALT_PREFIX = 'lavendar';

export async function deriveKeyWithSalt(
	password: string,
	username: string,
	saltPrefix: string
): Promise<string> {
	const enc = new TextEncoder();
	const baseKey = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
		'deriveBits'
	]);
	const bits = await crypto.subtle.deriveBits(
		{
			name: 'PBKDF2',
			salt: enc.encode(`${saltPrefix}:${username}`),
			iterations: 100000,
			hash: 'SHA-256'
		},
		baseKey,
		256
	);
	return btoa(String.fromCharCode(...new Uint8Array(bits)));
}

export async function deriveLegacyKey(password: string, username: string): Promise<string> {
	return deriveKeyWithSalt(password, username, LEGACY_SALT_PREFIX);
}

export async function deriveKeyFromPassword(password: string, username: string): Promise<string> {
	return deriveKeyWithSalt(password, username, 'lavender');
}

export async function importKey(base64Key: string): Promise<CryptoKey> {
	const keyBytes = Uint8Array.from(atob(base64Key), (c) => c.charCodeAt(0));
	return crypto.subtle.importKey('raw', keyBytes, { name: ALGO, length: KEY_LENGTH }, false, [
		'encrypt',
		'decrypt'
	]);
}

export async function encrypt(
	data: string,
	key: CryptoKey
): Promise<{ encrypted: string; iv: string }> {
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const encoded = new TextEncoder().encode(data);
	const encrypted = await crypto.subtle.encrypt({ name: ALGO, iv }, key, encoded);
	return {
		encrypted: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
		iv: btoa(String.fromCharCode(...iv))
	};
}

export async function decrypt(
	encryptedBase64: string,
	ivBase64: string,
	key: CryptoKey
): Promise<string> {
	const encrypted = Uint8Array.from(atob(encryptedBase64), (c) => c.charCodeAt(0));
	const iv = Uint8Array.from(atob(ivBase64), (c) => c.charCodeAt(0));
	const decrypted = await crypto.subtle.decrypt({ name: ALGO, iv }, key, encrypted);
	return new TextDecoder().decode(decrypted);
}

// --- Session storage (never localStorage for security) ---

const EK_KEY = 'lavender_ek';
const EK_LEGACY_KEY = 'lavender_ek_legacy';

export function storeKey(base64Key: string): void {
	sessionStorage.setItem(EK_KEY, base64Key);
}

export function getStoredKey(): string | null {
	return sessionStorage.getItem(EK_KEY);
}

export function clearStoredKey(): void {
	sessionStorage.removeItem(EK_KEY);
	sessionStorage.removeItem(EK_LEGACY_KEY);
}

export function storeLegacyKey(base64Key: string): void {
	sessionStorage.setItem(EK_LEGACY_KEY, base64Key);
}

export function getLegacyKey(): string | null {
	return sessionStorage.getItem(EK_LEGACY_KEY);
}

export function clearLegacyKey(): void {
	sessionStorage.removeItem(EK_LEGACY_KEY);
}

// --- Recovery code helpers ---

/** Generate a 16-byte recovery code formatted as "XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX". */
export function generateRecoveryCode(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
	return `${hex.slice(0, 8)}-${hex.slice(8, 16)}-${hex.slice(16, 24)}-${hex.slice(24, 32)}`.toUpperCase();
}

/** Generate a random 16-byte base64 salt. */
export function generateClientSalt(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	return btoa(String.fromCharCode(...bytes));
}

/** PBKDF2-hash a value with the given base64 salt, returning a base64 256-bit hash. */
export async function hashWithSalt(value: string, salt: string): Promise<string> {
	const enc = new TextEncoder();
	const baseKey = await crypto.subtle.importKey('raw', enc.encode(value), 'PBKDF2', false, [
		'deriveBits'
	]);
	const bits = await crypto.subtle.deriveBits(
		{ name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' },
		baseKey,
		256
	);
	return btoa(String.fromCharCode(...new Uint8Array(bits)));
}

/** Derive an AES-GCM wrapping key from the recovery code via PBKDF2. */
async function deriveWrappingKey(recoveryCode: string): Promise<CryptoKey> {
	const enc = new TextEncoder();
	const baseKey = await crypto.subtle.importKey('raw', enc.encode(recoveryCode), 'PBKDF2', false, [
		'deriveKey'
	]);
	return crypto.subtle.deriveKey(
		{
			name: 'PBKDF2',
			salt: enc.encode('lavender-recovery'),
			iterations: 100000,
			hash: 'SHA-256'
		},
		baseKey,
		{ name: 'AES-GCM', length: 256 },
		false,
		['encrypt', 'decrypt']
	);
}

/** Wrap the base64 encryption key using the recovery code. */
export async function wrapEncryptionKey(
	encKeyBase64: string,
	recoveryCode: string
): Promise<{ wrapped: string; iv: string }> {
	const wrappingKey = await deriveWrappingKey(recoveryCode);
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const keyBytes = Uint8Array.from(atob(encKeyBase64), (c) => c.charCodeAt(0));
	const wrapped = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, wrappingKey, keyBytes);
	return {
		wrapped: btoa(String.fromCharCode(...new Uint8Array(wrapped))),
		iv: btoa(String.fromCharCode(...iv))
	};
}

/** Unwrap the wrapped key using the recovery code. Throws if the code is wrong. */
export async function unwrapEncryptionKey(
	wrappedBase64: string,
	ivBase64: string,
	recoveryCode: string
): Promise<string> {
	const wrappingKey = await deriveWrappingKey(recoveryCode);
	const wrapped = Uint8Array.from(atob(wrappedBase64), (c) => c.charCodeAt(0));
	const iv = Uint8Array.from(atob(ivBase64), (c) => c.charCodeAt(0));
	const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, wrappingKey, wrapped);
	return btoa(String.fromCharCode(...new Uint8Array(decrypted)));
}
