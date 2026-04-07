import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/auth';
import { generateId } from '$lib/server/crypto';
import { getPlatform } from '$lib/server/db';
import type { HealthEntryRow } from '$lib/server/types';
import type { EncryptedEntry } from '$lib/types';

const MAX_ENCRYPTED_DATA = 100000;
const MAX_IV = 100;

export const GET: RequestHandler = async (event) => {
	const { db } = getPlatform(event);
	const authResult = requireUser(event);
	if (authResult instanceof Response) return authResult;
	const { userId } = authResult;

	// Return only non-expired entries; cleanup happens on POST.
	const rows = await db
		.prepare(
			"SELECT * FROM health_entries WHERE user_id = ? AND expires_at >= datetime('now') ORDER BY created_at DESC"
		)
		.bind(userId)
		.all<HealthEntryRow>();

	const entries: EncryptedEntry[] = (rows.results || []).map((row: HealthEntryRow) => ({
		id: row.id,
		encryptedData: row.encrypted_data,
		iv: row.iv,
		createdAt: row.created_at,
		expiresAt: row.expires_at
	}));

	return json(entries);
};

export const POST: RequestHandler = async (event) => {
	const { db } = getPlatform(event);
	const authResult = requireUser(event);
	if (authResult instanceof Response) return authResult;
	const { userId } = authResult;

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

	const settings = await db
		.prepare('SELECT data_retention_days FROM user_settings WHERE user_id = ?')
		.bind(userId)
		.first<{ data_retention_days: number }>();

	const retentionDays = settings?.data_retention_days ?? 180;
	const id = generateId();
	const expiresAt = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000).toISOString();

	// Insert new entry and lazily clean up expired ones in a single batch.
	await db.batch([
		db
			.prepare(
				'INSERT INTO health_entries (id, user_id, encrypted_data, iv, expires_at) VALUES (?, ?, ?, ?, ?)'
			)
			.bind(id, userId, encryptedData, iv, expiresAt),
		db
			.prepare("DELETE FROM health_entries WHERE user_id = ? AND expires_at < datetime('now')")
			.bind(userId)
	]);

	return json({ id, createdAt: new Date().toISOString(), expiresAt }, { status: 201 });
};

export const DELETE: RequestHandler = async (event) => {
	const { db } = getPlatform(event);
	const authResult = requireUser(event);
	if (authResult instanceof Response) return authResult;
	const { userId } = authResult;

	await db.prepare('DELETE FROM health_entries WHERE user_id = ?').bind(userId).run();

	return json({ message: 'All entries deleted' });
};
