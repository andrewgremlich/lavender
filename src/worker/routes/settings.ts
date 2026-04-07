import { Hono } from "hono";
import type { UserSettings } from "../../shared/types.js";
import { authMiddleware, getUserId } from "../middleware/auth.js";
import type { Env, UserSettingsRow } from "../types.js";

const settings = new Hono<{ Bindings: Env }>();

settings.use("/*", authMiddleware());

const VALID_DATE_RANGES = new Set(["7", "30", "90", "180", "365", "all"]);

settings.get("/", async (c) => {
	const userId = getUserId(c);

	const row = await c.env.lavender_db
		.prepare("SELECT * FROM user_settings WHERE user_id = ?")
		.bind(userId)
		.first<UserSettingsRow>();

	if (!row) {
		return c.json({ dataRetentionDays: 180, defaultDateRange: "30" } satisfies UserSettings);
	}

	return c.json({
		dataRetentionDays: row.data_retention_days,
		defaultDateRange: (row.default_date_range ?? "30") as UserSettings["defaultDateRange"],
	} satisfies UserSettings);
});

settings.put("/", async (c) => {
	const userId = getUserId(c);
	const body = await c.req.json<Partial<UserSettings>>();

	if (body.dataRetentionDays === undefined && body.defaultDateRange === undefined) {
		return c.json({ error: "No settings provided." }, 400);
	}

	if (body.dataRetentionDays !== undefined) {
		const { dataRetentionDays } = body;
		if (dataRetentionDays < 180 || dataRetentionDays > 3650) {
			return c.json(
				{
					error: "Invalid retention period. Must be between 180 days and 10 years (3650 days).",
				},
				400,
			);
		}

		await c.env.lavender_db
			.prepare(
				"INSERT INTO user_settings (user_id, data_retention_days, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(user_id) DO UPDATE SET data_retention_days = ?, updated_at = datetime('now')",
			)
			.bind(userId, dataRetentionDays, dataRetentionDays)
			.run();

		// Update expiration dates on existing entries
		const newExpiresAt = new Date(
			Date.now() + dataRetentionDays * 24 * 60 * 60 * 1000,
		).toISOString();
		await c.env.lavender_db
			.prepare("UPDATE health_entries SET expires_at = ? WHERE user_id = ?")
			.bind(newExpiresAt, userId)
			.run();
	}

	if (body.defaultDateRange !== undefined) {
		if (!VALID_DATE_RANGES.has(body.defaultDateRange)) {
			return c.json({ error: "Invalid date range." }, 400);
		}

		await c.env.lavender_db
			.prepare(
				"INSERT INTO user_settings (user_id, default_date_range, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(user_id) DO UPDATE SET default_date_range = ?, updated_at = datetime('now')",
			)
			.bind(userId, body.defaultDateRange, body.defaultDateRange)
			.run();
	}

	const row = await c.env.lavender_db
		.prepare("SELECT * FROM user_settings WHERE user_id = ?")
		.bind(userId)
		.first<UserSettingsRow>();

	return c.json({
		dataRetentionDays: row?.data_retention_days ?? 180,
		defaultDateRange: ((row?.default_date_range ?? "30") as UserSettings["defaultDateRange"]),
	} satisfies UserSettings);
});

export { settings };
