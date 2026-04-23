import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPlatform } from '$lib/server/db';
import { requireUser } from '$lib/server/auth';
import { generateId } from '$lib/server/crypto';

export const GET: RequestHandler = async (event) => {
	const { db } = getPlatform(event);
	const type = event.url.searchParams.get('type');

	let query = 'SELECT id, user_id, type, title, description, votes, created_at FROM community_posts';
	const params: string[] = [];
	if (type === 'feature_request' || type === 'question') {
		query += ' WHERE type = ?';
		params.push(type);
	}
	query += ' ORDER BY votes DESC, created_at DESC';

	const result = await db.prepare(query).bind(...params).all<{
		id: string;
		user_id: string;
		type: string;
		title: string;
		description: string;
		votes: number;
		created_at: string;
	}>();

	return json(result.results);
};

export const POST: RequestHandler = async (event) => {
	const { db } = getPlatform(event);
	const authResult = requireUser(event);
	if (authResult instanceof Response) return authResult;

	const body = await event.request.json().catch(() => null);
	if (!body || typeof body.title !== 'string' || typeof body.description !== 'string') {
		return json({ error: 'title and description required' }, { status: 400 });
	}
	const type = body.type;
	if (type !== 'feature_request' && type !== 'question') {
		return json({ error: 'type must be feature_request or question' }, { status: 400 });
	}

	const title = body.title.trim().slice(0, 200);
	const description = body.description.trim().slice(0, 2000);
	if (!title || !description) {
		return json({ error: 'title and description cannot be empty' }, { status: 400 });
	}

	const existing = await db
		.prepare('SELECT id FROM community_posts WHERE user_id = ? AND type = ?')
		.bind(authResult.userId, type)
		.first();
	if (existing) {
		const label = type === 'feature_request' ? 'feature request' : 'question';
		return json({ error: `You already have an active ${label}. Delete it before submitting another.` }, { status: 409 });
	}

	const id = generateId();
	await db
		.prepare(
			'INSERT INTO community_posts (id, user_id, type, title, description) VALUES (?, ?, ?, ?, ?)'
		)
		.bind(id, authResult.userId, type, title, description)
		.run();

	return json({ id }, { status: 201 });
};
