import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPlatform } from '$lib/server/db';
import { hashPassword, timingSafeEqual } from '$lib/server/crypto';
import { signJwt } from '$lib/server/jwt';
import type { UserRow } from '$lib/server/types';

const DEMO_USERNAME = 'demo';

export const POST: RequestHandler = async (event) => {
	const { db, jwtSecret, env } = getPlatform(event);
	const demoPassword = env.DEMO_PASSWORD;

	if (!demoPassword) {
		return json({ error: 'Demo account not configured' }, { status: 503 });
	}

	const user = await db
		.prepare('SELECT * FROM users WHERE username = ?')
		.bind(DEMO_USERNAME)
		.first<UserRow>();

	if (!user || user.role !== 'demo') {
		return json({ error: 'Demo account unavailable' }, { status: 503 });
	}

	const passwordHash = await hashPassword(demoPassword, user.salt);
	if (!timingSafeEqual(passwordHash, user.password_hash)) {
		return json({ error: 'Demo account misconfigured' }, { status: 500 });
	}

	const token = await signJwt(
		{
			sub: user.id,
			username: DEMO_USERNAME,
			role: 'demo',
			exp: Math.floor(Date.now() / 1000) + 86400
		},
		jwtSecret
	);
	return json({ token, username: DEMO_USERNAME, hasRecovery: false, role: 'demo' as const });
};
