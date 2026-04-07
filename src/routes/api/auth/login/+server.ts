import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPlatform } from '$lib/server/db';
import { hashPassword, timingSafeEqual } from '$lib/server/crypto';
import { signJwt } from '$lib/server/jwt';
import type { UserRow } from '$lib/server/types';

export const POST: RequestHandler = async (event) => {
	const { db, jwtSecret } = getPlatform(event);
	const { username, password } = (await event.request.json()) as {
		username?: string;
		password?: string;
	};

	if (!username || !password) {
		return json({ error: 'Username and password required' }, { status: 400 });
	}

	const user = await db
		.prepare('SELECT * FROM users WHERE username = ?')
		.bind(username)
		.first<UserRow>();

	if (!user) {
		return json({ error: 'Invalid credentials' }, { status: 401 });
	}

	const passwordHash = await hashPassword(password, user.salt);
	if (!timingSafeEqual(passwordHash, user.password_hash)) {
		return json({ error: 'Invalid credentials' }, { status: 401 });
	}

	const hasRecovery = !!(user.wrapped_encryption_key && user.recovery_code_hash);

	const token = await signJwt(
		{ sub: user.id, username, exp: Math.floor(Date.now() / 1000) + 86400 },
		jwtSecret
	);
	return json({ token, username, hasRecovery });
};
