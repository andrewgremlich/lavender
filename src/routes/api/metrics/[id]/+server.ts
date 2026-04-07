import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuth } from '$lib/server/auth';
import { getPlatform } from '$lib/server/db';

const MAX_ENCRYPTED_DATA = 100000;
const MAX_IV = 100;

export const PUT: RequestHandler = async (event) => {
	const { db, jwtSecret } = getPlatform(event);
	const authResult = await requireAuth(event, jwtSecret);
	if (authResult instanceof Response) return authResult;
	const { userId } = authResult;

	const entryId = event.params.id;
	const { encryptedData, iv } = (await event.request.json()) as {
		encryptedData?: string;
		iv?: string;
	};

	if (!encryptedData || !iv) {
		return json({ error: 'Encrypted data and IV required' }, { status: 400 });
	}
	if (encryptedData.length > MAX_ENCRYPTED_DATA || iv.length > MAX_IV) {
		return json({ error: 'Payload too large' }, { status: 413 });
	}

	const existing = await db
		.prepare('SELECT id FROM health_entries WHERE id = ? AND user_id = ?')
		.bind(entryId, userId)
		.first();

	if (!existing) {
		return json({ error: 'Entry not found' }, { status: 404 });
	}

	await db
		.prepare('UPDATE health_entries SET encrypted_data = ?, iv = ? WHERE id = ? AND user_id = ?')
		.bind(encryptedData, iv, entryId, userId)
		.run();

	return json({ message: 'Updated' });
};

export const DELETE: RequestHandler = async (event) => {
	const { db, jwtSecret } = getPlatform(event);
	const authResult = await requireAuth(event, jwtSecret);
	if (authResult instanceof Response) return authResult;
	const { userId } = authResult;

	const entryId = event.params.id;
	await db
		.prepare('DELETE FROM health_entries WHERE id = ? AND user_id = ?')
		.bind(entryId, userId)
		.run();

	return json({ message: 'Deleted' });
};
