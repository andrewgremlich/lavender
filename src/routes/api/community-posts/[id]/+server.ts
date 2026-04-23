import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPlatform } from '$lib/server/db';
import { requireUser } from '$lib/server/auth';

export const DELETE: RequestHandler = async (event) => {
	const { db } = getPlatform(event);
	const authResult = requireUser(event);
	if (authResult instanceof Response) return authResult;

	const postId = event.params.id;

	const post = await db
		.prepare('SELECT user_id FROM community_posts WHERE id = ?')
		.bind(postId)
		.first<{ user_id: string }>();

	if (!post) {
		return json({ error: 'Post not found' }, { status: 404 });
	}

	if (post.user_id !== authResult.userId && authResult.role !== 'admin') {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	await db.prepare('DELETE FROM community_posts WHERE id = ?').bind(postId).run();

	return json({ message: 'Deleted' });
};
