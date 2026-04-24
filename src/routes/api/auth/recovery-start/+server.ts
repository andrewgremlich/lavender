import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { hashPassword, timingSafeEqual } from '$lib/server/crypto';
import { getPlatform } from '$lib/server/db';
import type { UserRow } from '$lib/server/types';

/**
 * POST /api/auth/recovery-start — verify recovery code and return wrapped key + entries.
 * No JWT required; authenticated by the recovery code (hashed server-side against stored hash).
 */
export const POST: RequestHandler = async (event) => {
	const { db } = getPlatform(event);
	const { username, recoveryCode } = (await event.request.json()) as {
		username?: string;
		recoveryCode?: string;
	};

	if (!username || !recoveryCode) {
		return json({ error: 'Username and recovery code required' }, { status: 400 });
	}

	const user = await db
		.prepare('SELECT * FROM users WHERE username = ?')
		.bind(username)
		.first<UserRow>();

	if (
		!user ||
		!user.recovery_code_hash ||
		!user.recovery_code_salt ||
		!user.wrapped_encryption_key ||
		!user.wrapped_encryption_key_iv
	) {
		return json({ error: 'Invalid username or recovery code' }, { status: 401 });
	}

	const suppliedHash = await hashPassword(recoveryCode, user.recovery_code_salt);
	if (!timingSafeEqual(suppliedHash, user.recovery_code_hash)) {
		return json({ error: 'Invalid username or recovery code' }, { status: 401 });
	}

	type EntryRow = { id: string; encrypted_data: string; iv: string };
	const entries = await db
		.prepare('SELECT id, encrypted_data, iv FROM health_entries WHERE user_id = ?')
		.bind(user.id)
		.all<EntryRow>();

	const mappedEntries = (entries.results ?? []).map((e: EntryRow) => ({
		id: e.id,
		encryptedData: e.encrypted_data,
		iv: e.iv
	}));

	return json({
		wrappedEncryptionKey: user.wrapped_encryption_key,
		wrappedEncryptionKeyIv: user.wrapped_encryption_key_iv,
		entries: mappedEntries
	});
};
