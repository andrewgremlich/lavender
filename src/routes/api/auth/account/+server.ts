import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuth } from '$lib/server/auth';
import { getPlatform } from '$lib/server/db';

export const DELETE: RequestHandler = async (event) => {
	const { db, jwtSecret } = getPlatform(event);
	const authResult = await requireAuth(event, jwtSecret);
	if (authResult instanceof Response) return authResult;
	const { userId } = authResult;

	// CASCADE handles related records
	await db.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();

	return json({ message: 'Account deleted' });
};
