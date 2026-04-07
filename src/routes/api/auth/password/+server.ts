import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuth } from '$lib/server/auth';
import { generateSalt, hashPassword, timingSafeEqual } from '$lib/server/crypto';
import { getPlatform } from '$lib/server/db';
import { signJwt } from '$lib/server/jwt';
import type { UserRow } from '$lib/server/types';
import { validatePassword } from '$lib/server/validation';

interface PasswordBody {
	oldPassword?: string;
	newPassword?: string;
	reEncryptedEntries?: Array<{ id: string; encryptedData: string; iv: string }>;
}

export const PUT: RequestHandler = async (event) => {
	const { db, jwtSecret } = getPlatform(event);
	const authResult = await requireAuth(event, jwtSecret);
	if (authResult instanceof Response) return authResult;
	const { userId } = authResult;

	const { oldPassword, newPassword, reEncryptedEntries } =
		(await event.request.json()) as PasswordBody;

	if (!oldPassword || !newPassword) {
		return json({ error: 'Old and new passwords required' }, { status: 400 });
	}
	const passwordError = validatePassword(newPassword);
	if (passwordError) return json({ error: passwordError }, { status: 400 });

	const user = await db.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first<UserRow>();

	if (!user) {
		return json({ error: 'Invalid credentials' }, { status: 401 });
	}

	const oldHash = await hashPassword(oldPassword, user.salt);
	if (!timingSafeEqual(oldHash, user.password_hash)) {
		return json({ error: 'Current password is incorrect' }, { status: 401 });
	}

	const newSalt = generateSalt();
	const newHash = await hashPassword(newPassword, newSalt);

	const statements = [
		db
			.prepare('UPDATE users SET password_hash = ?, salt = ? WHERE id = ?')
			.bind(newHash, newSalt, userId)
	];

	if (reEncryptedEntries?.length) {
		for (const entry of reEncryptedEntries) {
			statements.push(
				db
					.prepare(
						'UPDATE health_entries SET encrypted_data = ?, iv = ? WHERE id = ? AND user_id = ?'
					)
					.bind(entry.encryptedData, entry.iv, entry.id, userId)
			);
		}
	}

	await db.batch(statements);

	const token = await signJwt(
		{
			sub: user.id,
			username: user.username,
			exp: Math.floor(Date.now() / 1000) + 86400
		},
		jwtSecret
	);
	return json({
		token,
		username: user.username,
		hasRecovery: !!(user.wrapped_encryption_key && user.recovery_code_hash)
	});
};
