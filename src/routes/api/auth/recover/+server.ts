import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateSalt, hashPassword, timingSafeEqual } from '$lib/server/crypto';
import { getPlatform } from '$lib/server/db';
import { signJwt } from '$lib/server/jwt';
import type { UserRow } from '$lib/server/types';
import { validatePassword } from '$lib/server/validation';

interface RecoverBody {
	username?: string;
	recoveryCode?: string;
	newPassword?: string;
	reEncryptedEntries?: Array<{ id: string; encryptedData: string; iv: string }>;
	newWrappedEncryptionKey?: string;
	newWrappedEncryptionKeyIv?: string;
	newRecoveryCodeHash?: string;
	newRecoveryCodeSalt?: string;
}

/**
 * POST /api/auth/recover — complete password recovery.
 * Verifies recovery code, atomically updates password + all entries + rotated recovery code.
 */
export const POST: RequestHandler = async (event) => {
	const { db, jwtSecret } = getPlatform(event);
	const body = (await event.request.json()) as RecoverBody;
	const {
		username,
		recoveryCode,
		newPassword,
		reEncryptedEntries,
		newWrappedEncryptionKey,
		newWrappedEncryptionKeyIv,
		newRecoveryCodeHash,
		newRecoveryCodeSalt
	} = body;

	if (!username || !recoveryCode || !newPassword) {
		return json({ error: 'All fields required' }, { status: 400 });
	}
	const passwordError = validatePassword(newPassword);
	if (passwordError) return json({ error: passwordError }, { status: 400 });

	if (
		!newWrappedEncryptionKey ||
		!newWrappedEncryptionKeyIv ||
		!newRecoveryCodeHash ||
		!newRecoveryCodeSalt
	) {
		return json({ error: 'All fields required' }, { status: 400 });
	}

	if (
		newWrappedEncryptionKey.length > 1024 ||
		newWrappedEncryptionKeyIv.length > 64 ||
		newRecoveryCodeHash.length > 512 ||
		newRecoveryCodeSalt.length > 512
	) {
		return json({ error: 'Invalid recovery fields' }, { status: 400 });
	}

	const user = await db
		.prepare('SELECT * FROM users WHERE username = ?')
		.bind(username)
		.first<UserRow>();

	if (!user || !user.recovery_code_hash || !user.recovery_code_salt) {
		return json({ error: 'Invalid username or recovery code' }, { status: 401 });
	}

	const suppliedHash = await hashPassword(recoveryCode, user.recovery_code_salt);
	if (!timingSafeEqual(suppliedHash, user.recovery_code_hash)) {
		return json({ error: 'Invalid username or recovery code' }, { status: 401 });
	}

	const newSalt = generateSalt();
	const newHash = await hashPassword(newPassword, newSalt);
	const newEpoch = (user.token_epoch ?? 0) + 1;

	const statements = [
		db
			.prepare(
				`UPDATE users SET password_hash = ?, salt = ?,
				 wrapped_encryption_key = ?, wrapped_encryption_key_iv = ?,
				 recovery_code_hash = ?, recovery_code_salt = ?,
				 token_epoch = ?
				 WHERE id = ?`
			)
			.bind(
				newHash,
				newSalt,
				newWrappedEncryptionKey,
				newWrappedEncryptionKeyIv,
				newRecoveryCodeHash,
				newRecoveryCodeSalt,
				newEpoch,
				user.id
			)
	];

	if (reEncryptedEntries?.length) {
		if (reEncryptedEntries.length > 365) {
			return json({ error: 'Too many entries' }, { status: 400 });
		}
		for (const entry of reEncryptedEntries) {
			if (
				typeof entry.id !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(entry.id) ||
				typeof entry.encryptedData !== 'string' || entry.encryptedData.length > 131072 ||
				typeof entry.iv !== 'string' || entry.iv.length > 64
			) {
				return json({ error: 'Invalid entry data' }, { status: 400 });
			}
			statements.push(
				db
					.prepare(
						'UPDATE health_entries SET encrypted_data = ?, iv = ? WHERE id = ? AND user_id = ?'
					)
					.bind(entry.encryptedData, entry.iv, entry.id, user.id)
			);
		}
	}

	await db.batch(statements);

	const token = await signJwt(
		{
			sub: user.id,
			username: user.username,
			role: user.role,
			epoch: newEpoch,
			exp: Math.floor(Date.now() / 1000) + 86400
		},
		jwtSecret
	);
	return json({ token, username: user.username, hasRecovery: true });
};
