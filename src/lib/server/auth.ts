import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { verifyJwt } from './jwt.js';

/**
 * Verifies the `Authorization: Bearer <jwt>` header on the incoming request
 * and returns the user id. On failure returns a Response that the caller
 * must return directly.
 *
 * This is temporary for Phase 2. Phase 3 will move JWT verification into
 * `hooks.server.ts` so protected `+server.ts` handlers can read
 * `event.locals.user` instead.
 */
export async function requireAuth(
	event: RequestEvent,
	jwtSecret: string
): Promise<{ userId: string; username: string } | Response> {
	const header = event.request.headers.get('authorization');
	if (!header?.startsWith('Bearer ')) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}
	const token = header.slice(7);
	const payload = await verifyJwt(token, jwtSecret);
	if (!payload) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}
	return { userId: payload.sub, username: payload.username };
}
