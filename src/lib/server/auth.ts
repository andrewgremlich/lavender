import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

/**
 * Returns `event.locals.user` if present (populated in `hooks.server.ts`),
 * otherwise returns a 401 Response the caller must return directly.
 */
export function requireUser(event: RequestEvent): { userId: string; username: string } | Response {
	const user = event.locals.user;
	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}
	return user;
}
