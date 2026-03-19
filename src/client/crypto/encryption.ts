const ALGO = "AES-GCM";
const KEY_LENGTH = 256;

export async function deriveKeyFromPassword(
	password: string,
	username: string,
): Promise<string> {
	const enc = new TextEncoder();
	const baseKey = await crypto.subtle.importKey(
		"raw",
		enc.encode(password),
		"PBKDF2",
		false,
		["deriveBits"],
	);
	const bits = await crypto.subtle.deriveBits(
		{
			name: "PBKDF2",
			salt: enc.encode(`lavendar:${username}`),
			iterations: 100000,
			hash: "SHA-256",
		},
		baseKey,
		256,
	);
	return btoa(String.fromCharCode(...new Uint8Array(bits)));
}

export async function generateEncryptionKey(): Promise<string> {
	const key = await crypto.subtle.generateKey(
		{ name: ALGO, length: KEY_LENGTH },
		true,
		["encrypt", "decrypt"],
	);
	const exported = await crypto.subtle.exportKey("raw", key);
	return btoa(String.fromCharCode(...new Uint8Array(exported)));
}

export async function importKey(base64Key: string): Promise<CryptoKey> {
	const keyBytes = Uint8Array.from(atob(base64Key), (c) => c.charCodeAt(0));
	return crypto.subtle.importKey(
		"raw",
		keyBytes,
		{ name: ALGO, length: KEY_LENGTH },
		false,
		["encrypt", "decrypt"],
	);
}

export async function encrypt(
	data: string,
	key: CryptoKey,
): Promise<{ encrypted: string; iv: string }> {
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const encoded = new TextEncoder().encode(data);

	const encrypted = await crypto.subtle.encrypt(
		{ name: ALGO, iv },
		key,
		encoded,
	);

	return {
		encrypted: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
		iv: btoa(String.fromCharCode(...iv)),
	};
}

export async function decrypt(
	encryptedBase64: string,
	ivBase64: string,
	key: CryptoKey,
): Promise<string> {
	const encrypted = Uint8Array.from(atob(encryptedBase64), (c) =>
		c.charCodeAt(0),
	);
	const iv = Uint8Array.from(atob(ivBase64), (c) => c.charCodeAt(0));

	const decrypted = await crypto.subtle.decrypt(
		{ name: ALGO, iv },
		key,
		encrypted,
	);

	return new TextDecoder().decode(decrypted);
}

// Convert a base64url string (from WebAuthn PRF output) to a Uint8Array
export function base64urlToBytes(b64url: string): Uint8Array {
	const b64 = b64url
		.replace(/-/g, "+")
		.replace(/_/g, "/")
		.padEnd(b64url.length + ((4 - (b64url.length % 4)) % 4), "=");
	return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

// Wrap the user's encryption key using the PRF output as a key-encryption-key (KEK).
// The server stores the wrapped key; only the passkey (via PRF) can unwrap it.
export async function wrapKeyWithPRF(
	encryptionKeyB64: string,
	prfBytes: Uint8Array,
): Promise<{ wrappedKey: string; iv: string }> {
	const kek = await crypto.subtle.importKey(
		"raw",
		prfBytes,
		{ name: ALGO, length: KEY_LENGTH },
		false,
		["encrypt"],
	);
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const keyBytes = Uint8Array.from(atob(encryptionKeyB64), (c) =>
		c.charCodeAt(0),
	);
	const wrapped = await crypto.subtle.encrypt(
		{ name: ALGO, iv },
		kek,
		keyBytes,
	);
	return {
		wrappedKey: btoa(String.fromCharCode(...new Uint8Array(wrapped))),
		iv: btoa(String.fromCharCode(...iv)),
	};
}

// Unwrap a PRF-wrapped encryption key using the current PRF output.
export async function unwrapKeyWithPRF(
	prfBytes: Uint8Array,
	wrappedKeyB64: string,
	ivB64: string,
): Promise<string> {
	const kek = await crypto.subtle.importKey(
		"raw",
		prfBytes,
		{ name: ALGO, length: KEY_LENGTH },
		false,
		["decrypt"],
	);
	const wrappedKey = Uint8Array.from(atob(wrappedKeyB64), (c) =>
		c.charCodeAt(0),
	);
	const iv = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0));
	const unwrapped = await crypto.subtle.decrypt(
		{ name: ALGO, iv },
		kek,
		wrappedKey,
	);
	return btoa(String.fromCharCode(...new Uint8Array(unwrapped)));
}

// Store/retrieve encryption key from sessionStorage (never localStorage for security)
export function storeKey(base64Key: string): void {
	sessionStorage.setItem("lavendar_ek", base64Key);
}

export function getStoredKey(): string | null {
	return sessionStorage.getItem("lavendar_ek");
}

export function clearStoredKey(): void {
	sessionStorage.removeItem("lavendar_ek");
}
