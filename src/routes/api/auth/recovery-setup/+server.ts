import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuth } from '$lib/server/auth';
import { getPlatform } from '$lib/server/db';

interface RecoverySetupBody {
	wrappedEncryptionKey?: string;
	wrappedEncryptionKeyIv?: string;
	recoveryCodeHash?: string;
	recoveryCodeSalt?: string;
}

export const POST: RequestHandler = async (event) => {
	const { db, jwtSecret } = getPlatform(event);
	const authResult = await requireAuth(event, jwtSecret);
	if (authResult instanceof Response) return authResult;
	const { userId } = authResult;

	const body = (await event.request.json()) as RecoverySetupBody;
	const { wrappedEncryptionKey, wrappedEncryptionKeyIv, recoveryCodeHash, recoveryCodeSalt } = body;

	if (!wrappedEncryptionKey || !wrappedEncryptionKeyIv || !recoveryCodeHash || !recoveryCodeSalt) {
		return json({ error: 'All recovery fields required' }, { status: 400 });
	}

	await db
		.prepare(
			`UPDATE users SET wrapped_encryption_key = ?, wrapped_encryption_key_iv = ?,
			 recovery_code_hash = ?, recovery_code_salt = ? WHERE id = ?`
		)
		.bind(wrappedEncryptionKey, wrappedEncryptionKeyIv, recoveryCodeHash, recoveryCodeSalt, userId)
		.run();

	return json({ message: 'Recovery code saved' });
};
