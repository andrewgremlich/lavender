import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin } from '$lib/server/auth';
import { getPlatform } from '$lib/server/db';

export const POST: RequestHandler = async (event) => {
	const { db } = getPlatform(event);
	const authResult = requireAdmin(event);
	if (authResult instanceof Response) return authResult;

	const result = await db
		.prepare("DELETE FROM health_entries WHERE expires_at < datetime('now')")
		.run();

	return json({
		message: 'Expired entries cleaned up',
		deletedCount: result.meta.changes
	});
};
