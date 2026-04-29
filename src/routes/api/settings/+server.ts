import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/auth';
import { getPlatform } from '$lib/server/db';
import type { UserSettingsRow } from '$lib/server/types';
import type { SubscriptionStatus, UserSettings } from '$lib/types';

const VALID_DATE_RANGES = new Set<UserSettings['defaultDateRange']>(['7', '30', 'all']);

export const GET: RequestHandler = async (event) => {
	const { db } = getPlatform(event);
	const authResult = requireUser(event);
	if (authResult instanceof Response) return authResult;
	const { userId } = authResult;

	const row = await db
		.prepare('SELECT * FROM user_settings WHERE user_id = ?')
		.bind(userId)
		.first<UserSettingsRow>();

	const userRow = await db
		.prepare('SELECT subscription_status FROM users WHERE id = ?')
		.bind(userId)
		.first<{ subscription_status: SubscriptionStatus }>();
	const subscriptionStatus: SubscriptionStatus = userRow?.subscription_status ?? 'free';

	if (!row) {
		return json({
			dataRetentionDays: 180,
			defaultDateRange: '30',
			subscriptionStatus
		} satisfies UserSettings);
	}

	return json({
		dataRetentionDays: row.data_retention_days,
		defaultDateRange: (row.default_date_range ?? '30') as UserSettings['defaultDateRange'],
		subscriptionStatus
	} satisfies UserSettings);
};

export const PUT: RequestHandler = async (event) => {
	const { db } = getPlatform(event);
	const authResult = requireUser(event);
	if (authResult instanceof Response) return authResult;
	const { userId } = authResult;

	const body = (await event.request.json()) as Partial<UserSettings>;

	if (body.dataRetentionDays === undefined && body.defaultDateRange === undefined) {
		return json({ error: 'No settings provided.' }, { status: 400 });
	}

	if (body.dataRetentionDays !== undefined) {
		const { dataRetentionDays } = body;
		if (dataRetentionDays < 180 || dataRetentionDays > 3650) {
			return json(
				{
					error: 'Invalid retention period. Must be between 180 days and 10 years (3650 days).'
				},
				{ status: 400 }
			);
		}

		await db
			.prepare(
				"INSERT INTO user_settings (user_id, data_retention_days, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(user_id) DO UPDATE SET data_retention_days = ?, updated_at = datetime('now')"
			)
			.bind(userId, dataRetentionDays, dataRetentionDays)
			.run();

		// Update expiration dates on existing entries
		const newExpiresAt = new Date(
			Date.now() + dataRetentionDays * 24 * 60 * 60 * 1000
		).toISOString();
		await db
			.prepare('UPDATE health_entries SET expires_at = ? WHERE user_id = ?')
			.bind(newExpiresAt, userId)
			.run();
	}

	if (body.defaultDateRange !== undefined) {
		if (!VALID_DATE_RANGES.has(body.defaultDateRange)) {
			return json({ error: 'Invalid date range.' }, { status: 400 });
		}

		await db
			.prepare(
				"INSERT INTO user_settings (user_id, default_date_range, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(user_id) DO UPDATE SET default_date_range = ?, updated_at = datetime('now')"
			)
			.bind(userId, body.defaultDateRange, body.defaultDateRange)
			.run();
	}

	const row = await db
		.prepare('SELECT * FROM user_settings WHERE user_id = ?')
		.bind(userId)
		.first<UserSettingsRow>();

	const userRow2 = await db
		.prepare('SELECT subscription_status FROM users WHERE id = ?')
		.bind(userId)
		.first<{ subscription_status: SubscriptionStatus }>();

	return json({
		dataRetentionDays: row?.data_retention_days ?? 180,
		defaultDateRange: (row?.default_date_range ?? '30') as UserSettings['defaultDateRange'],
		subscriptionStatus: userRow2?.subscription_status ?? 'free'
	} satisfies UserSettings);
};
