import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/auth';
import { getPlatform } from '$lib/server/db';

export const DELETE: RequestHandler = async (event) => {
	const { db } = getPlatform(event);
	const authResult = requireUser(event);
	if (authResult instanceof Response) return authResult;
	const { userId } = authResult;

	// CASCADE handles related records
	await db.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();

	return json({ message: 'Account deleted' });
};
