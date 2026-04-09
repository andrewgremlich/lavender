import type { Role } from '$lib/types';
import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

type AuthUser = { userId: string; username: string; role: Role };

/**
 * Returns `event.locals.user` if present (populated in `hooks.server.ts`),
 * otherwise returns a 401 Response the caller must return directly.
 */
export function requireUser(event: RequestEvent): AuthUser | Response {
	const user = event.locals.user;
	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}
	return user;
}

/**
 * Like requireUser but also blocks demo-role accounts, returning 403.
 * Use on endpoints that must not be no-ops (password change, account delete).
 */
export function requireNonDemoUser(event: RequestEvent): AuthUser | Response {
	const result = requireUser(event);
	if (result instanceof Response) return result;
	if (result.role === 'demo') {
		return json({ error: 'Not available for guest accounts' }, { status: 403 });
	}
	return result;
}
