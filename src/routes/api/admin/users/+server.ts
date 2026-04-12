import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPlatform } from '$lib/server/db';
import { requireAdmin } from '$lib/server/auth';
import type { UserRow } from '$lib/server/types';

export const GET: RequestHandler = async (event) => {
	const { db } = getPlatform(event);
	const authResult = requireAdmin(event);
	if (authResult instanceof Response) return authResult;

	const result = await db
		.prepare('SELECT id, username, role, created_at FROM users ORDER BY created_at DESC')
		.all<Pick<UserRow, 'id' | 'username' | 'role' | 'created_at'>>();

	return json(result.results);
};
