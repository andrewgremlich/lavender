import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPlatform } from '$lib/server/db';
import { requireAdmin } from '$lib/server/auth';
import type { Role } from '$lib/types';

const VALID_ROLES: Role[] = ['user', 'demo', 'admin', 'banned'];

export const DELETE: RequestHandler = async (event) => {
	const { db } = getPlatform(event);
	const authResult = requireAdmin(event);
	if (authResult instanceof Response) return authResult;

	const { id } = event.params;

	if (id === authResult.userId) {
		return json({ error: 'Cannot delete your own account' }, { status: 400 });
	}

	await db.prepare('DELETE FROM users WHERE id = ?').bind(id).run();

	return json({ message: 'User deleted' });
};

export const PATCH: RequestHandler = async (event) => {
	const { db } = getPlatform(event);
	const authResult = requireAdmin(event);
	if (authResult instanceof Response) return authResult;

	const { id } = event.params;

	if (id === authResult.userId) {
		return json({ error: 'Cannot change your own role' }, { status: 400 });
	}

	const { role } = (await event.request.json()) as { role?: Role };

	if (!role || !VALID_ROLES.includes(role)) {
		return json({ error: 'Invalid role' }, { status: 400 });
	}

	await db.prepare('UPDATE users SET role = ? WHERE id = ?').bind(role, id).run();

	return json({ message: 'Role updated', role });
};
