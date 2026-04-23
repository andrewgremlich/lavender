import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPlatform } from '$lib/server/db';
import { requireAdmin } from '$lib/server/auth';

export const DELETE: RequestHandler = async (event) => {
	const { db } = getPlatform(event);
	const authResult = requireAdmin(event);
	if (authResult instanceof Response) return authResult;

	const postId = event.params.id;
	const result = await db
		.prepare('DELETE FROM community_posts WHERE id = ?')
		.bind(postId)
		.run();

	if (!result.meta.changes) {
		return json({ error: 'Post not found' }, { status: 404 });
	}

	return json({ message: 'Deleted' });
};
