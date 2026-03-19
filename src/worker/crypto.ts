const ITERATIONS = 100000;
const KEY_LENGTH = 256;
const HASH_ALGO = "SHA-256";

export async function hashPassword(
	password: string,
	salt: string,
): Promise<string> {
	const encoder = new TextEncoder();
	const keyMaterial = await crypto.subtle.importKey(
		"raw",
		encoder.encode(password),
		"PBKDF2",
		false,
		["deriveBits"],
	);

	const derivedBits = await crypto.subtle.deriveBits(
		{
			name: "PBKDF2",
			salt: encoder.encode(salt),
			iterations: ITERATIONS,
			hash: HASH_ALGO,
		},
		keyMaterial,
		KEY_LENGTH,
	);

	return btoa(String.fromCharCode(...new Uint8Array(derivedBits)));
}

export function generateSalt(): string {
	const saltBytes = new Uint8Array(16);
	crypto.getRandomValues(saltBytes);
	return btoa(String.fromCharCode(...saltBytes));
}

export function generateId(): string {
	return crypto.randomUUID();
}
