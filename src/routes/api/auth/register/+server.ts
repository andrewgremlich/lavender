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

	if (env.TURNSTILE_SECRET_KEY) {
		if (!turnstileToken) {
			return json({ error: 'CAPTCHA required' }, { status: 400 });
		}
		const ip = event.request.headers.get('CF-Connecting-IP') ?? '';
		const captcha = await verifyTurnstile(turnstileToken, env.TURNSTILE_SECRET_KEY, ip);
		if (!captcha.success) {
			return json({ error: 'CAPTCHA verification failed' }, { status: 400 });
		}
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
		{ sub: id, username, exp: Math.floor(Date.now() / 1000) + 86400 },
		jwtSecret
	);
	return json({ token, username, hasRecovery }, { status: 201 });
};
