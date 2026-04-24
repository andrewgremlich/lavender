import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPlatform } from '$lib/server/db';
import { generateId, generateSalt, hashPassword } from '$lib/server/crypto';
import { signJwt } from '$lib/server/jwt';
import { validatePassword, validateUsername } from '$lib/server/validation';
import { verifyTurnstile } from '$lib/server/turnstile';

interface RegisterBody {
	username?: string;
	password?: string;
	wrappedEncryptionKey?: string;
	wrappedEncryptionKeyIv?: string;
	recoveryCodeHash?: string;
	recoveryCodeSalt?: string;
	turnstileToken?: string;
}

const REG_LIMIT_MAX = 3;
const REG_LIMIT_WINDOW_SEC = 24 * 60 * 60;

export const POST: RequestHandler = async (event) => {
	const { db, jwtSecret, env } = getPlatform(event);
	const body: RegisterBody = await event.request.json();
	const {
		username,
		password,
		wrappedEncryptionKey,
		wrappedEncryptionKeyIv,
		recoveryCodeHash,
		recoveryCodeSalt,
		turnstileToken
	} = body;

	const ip = event.request.headers.get('CF-Connecting-IP') ?? 'unknown';

	if (env.TURNSTILE_SECRET_KEY) {
		if (!turnstileToken) {
			return json({ error: 'CAPTCHA required' }, { status: 400 });
		}
		const captcha = await verifyTurnstile(turnstileToken, env.TURNSTILE_SECRET_KEY, ip);
		if (!captcha.success) {
			return json({ error: 'CAPTCHA verification failed' }, { status: 400 });
		}
	}

	const kv = event.platform?.env?.RATE_LIMIT_KV;
	if (kv) {
		const regKey = `rl:reg:${ip}`;
		const now = Math.floor(Date.now() / 1000);
		const raw = await kv.get(regKey);
		let count = 0;
		let reset = now + REG_LIMIT_WINDOW_SEC;
		if (raw) {
			try {
				const parsed = JSON.parse(raw) as { count: number; reset: number };
				if (parsed.reset > now) {
					count = parsed.count;
					reset = parsed.reset;
				}
			} catch { /* treat as fresh window */ }
		}
		if (count >= REG_LIMIT_MAX) {
			return json({ error: 'Too many registrations from this IP. Try again later.' }, {
				status: 429,
				headers: { 'retry-after': String(reset - now) }
			});
		}
		await kv.put(regKey, JSON.stringify({ count: count + 1, reset }), {
			expirationTtl: Math.max(60, reset - now)
		});
	}

	if (!username || !password) {
		return json({ error: 'Username and password required' }, { status: 400 });
	}
	const usernameError = validateUsername(username);
	if (usernameError) return json({ error: usernameError }, { status: 400 });
	const passwordError = validatePassword(password);
	if (passwordError) return json({ error: passwordError }, { status: 400 });

	const existing = await db
		.prepare('SELECT id FROM users WHERE username = ?')
		.bind(username)
		.first();
	if (existing) {
		return json({ error: 'Username already taken' }, { status: 409 });
	}

	const id = generateId();
	const salt = generateSalt();
	const passwordHash = await hashPassword(password, salt);

	if (
		(wrappedEncryptionKey && wrappedEncryptionKey.length > 1024) ||
		(wrappedEncryptionKeyIv && wrappedEncryptionKeyIv.length > 64) ||
		(recoveryCodeHash && recoveryCodeHash.length > 512) ||
		(recoveryCodeSalt && recoveryCodeSalt.length > 512)
	) {
		return json({ error: 'Invalid recovery fields' }, { status: 400 });
	}

	const hasRecovery = !!(
		wrappedEncryptionKey &&
		wrappedEncryptionKeyIv &&
		recoveryCodeHash &&
		recoveryCodeSalt
	);

	await db
		.prepare(
			`INSERT INTO users (id, username, password_hash, salt, recovery_code_hash, recovery_code_salt, wrapped_encryption_key, wrapped_encryption_key_iv)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.bind(
			id,
			username,
			passwordHash,
			salt,
			recoveryCodeHash ?? null,
			recoveryCodeSalt ?? null,
			wrappedEncryptionKey ?? null,
			wrappedEncryptionKeyIv ?? null
		)
		.run();

	await db.prepare('INSERT INTO user_settings (user_id) VALUES (?)').bind(id).run();

	const token = await signJwt(
		{ sub: id, username, role: 'user', epoch: 0, exp: Math.floor(Date.now() / 1000) + 86400 },
		jwtSecret
	);
	return json({ token, username, hasRecovery }, { status: 201 });
};
