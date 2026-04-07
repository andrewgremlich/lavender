// Hand-rolled HS256 JWT using Web Crypto. No external dependencies.
//
// A JWT is three base64url-encoded parts joined by dots:
//   base64url(header) + "." + base64url(payload) + "." + base64url(signature)
// where the signature is HMAC-SHA256 over the first two parts using the secret.

export interface JwtPayload {
	sub: string;
	username: string;
	exp: number;
	iat?: number;
	[key: string]: unknown;
}

const HEADER = { alg: 'HS256', typ: 'JWT' } as const;
const HEADER_B64 = base64urlEncode(new TextEncoder().encode(JSON.stringify(HEADER)));

function base64urlEncode(bytes: Uint8Array | ArrayBuffer): string {
	const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
	let binary = '';
	for (let i = 0; i < arr.byteLength; i++) {
		binary += String.fromCharCode(arr[i]);
	}
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(value: string): Uint8Array<ArrayBuffer> {
	const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4);
	const binary = atob(padded);
	const buffer = new ArrayBuffer(binary.length);
	const out = new Uint8Array(buffer);
	for (let i = 0; i < binary.length; i++) {
		out[i] = binary.charCodeAt(i);
	}
	return out;
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
	return crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign', 'verify']
	);
}

export async function signJwt(payload: JwtPayload, secret: string): Promise<string> {
	const payloadB64 = base64urlEncode(new TextEncoder().encode(JSON.stringify(payload)));
	const data = `${HEADER_B64}.${payloadB64}`;
	const key = await importHmacKey(secret);
	const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
	return `${data}.${base64urlEncode(signature)}`;
}

export async function verifyJwt(token: string, secret: string): Promise<JwtPayload | null> {
	const parts = token.split('.');
	if (parts.length !== 3) return null;
	const [headerB64, payloadB64, signatureB64] = parts;

	// Verify the header matches what we issue. This doubles as an alg check
	// (never trust the `alg` field on an incoming token).
	if (headerB64 !== HEADER_B64) return null;

	const data = `${headerB64}.${payloadB64}`;
	const key = await importHmacKey(secret);
	let signature: Uint8Array<ArrayBuffer>;
	try {
		signature = base64urlDecode(signatureB64);
	} catch {
		return null;
	}
	const valid = await crypto.subtle.verify('HMAC', key, signature, new TextEncoder().encode(data));
	if (!valid) return null;

	let payload: JwtPayload;
	try {
		payload = JSON.parse(new TextDecoder().decode(base64urlDecode(payloadB64)));
	} catch {
		return null;
	}

	if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) {
		return null;
	}

	return payload;
}
