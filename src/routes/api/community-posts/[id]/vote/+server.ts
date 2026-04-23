import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPlatform } from '$lib/server/db';
import { requireUser } from '$lib/server/auth';

export const POST: RequestHandler = async (event) => {
	const { db } = getPlatform(event);
	const authResult = requireUser(event);
	if (authResult instanceof Response) return authResult;

	const postId = event.params.id;

	const post = await db
		.prepare('SELECT id, votes FROM community_posts WHERE id = ?')
		.bind(postId)
		.first<{ id: string; votes: number }>();

	if (!post) {
		return json({ error: 'Post not found' }, { status: 404 });
	}

	const existing = await db
		.prepare('SELECT 1 FROM community_post_votes WHERE user_id = ? AND post_id = ?')
		.bind(authResult.userId, postId)
		.first();

	if (existing) {
		await db
			.prepare('DELETE FROM community_post_votes WHERE user_id = ? AND post_id = ?')
			.bind(authResult.userId, postId)
			.run();
		await db
			.prepare('UPDATE community_posts SET votes = votes - 1 WHERE id = ?')
			.bind(postId)
			.run();
		return json({ voted: false, votes: post.votes - 1 });
	}

	await db
		.prepare('INSERT INTO community_post_votes (user_id, post_id) VALUES (?, ?)')
		.bind(authResult.userId, postId)
		.run();
	await db
		.prepare('UPDATE community_posts SET votes = votes + 1 WHERE id = ?')
		.bind(postId)
		.run();
	return json({ voted: true, votes: post.votes + 1 });
};
