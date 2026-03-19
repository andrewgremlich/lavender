import { Hono } from "hono";
import type { UserSettings } from "../../shared/types.js";
import { authMiddleware, getUserId } from "../middleware/auth.js";
import type { Env, UserSettingsRow } from "../types.js";

const settings = new Hono<{ Bindings: Env }>();

settings.use("/*", authMiddleware());

settings.get("/", async (c) => {
	const userId = getUserId(c);

	const row = await c.env.DB.prepare(
		"SELECT * FROM user_settings WHERE user_id = ?",
	)
		.bind(userId)
		.first<UserSettingsRow>();

	if (!row) {
		return c.json({ dataRetentionDays: 365 });
	}

	return c.json({
		dataRetentionDays: row.data_retention_days,
	} satisfies UserSettings);
});

settings.put("/", async (c) => {
	const userId = getUserId(c);
	const { dataRetentionDays } = await c.req.json<UserSettings>();

	if (!dataRetentionDays || dataRetentionDays < 1) {
		return c.json({ error: "Invalid retention period" }, 400);
	}

	await c.env.DB.prepare(
		"INSERT INTO user_settings (user_id, data_retention_days, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(user_id) DO UPDATE SET data_retention_days = ?, updated_at = datetime('now')",
	)
		.bind(userId, dataRetentionDays, dataRetentionDays)
		.run();

	// Update expiration dates on existing entries
	const newExpiresAt = new Date(
		Date.now() + dataRetentionDays * 24 * 60 * 60 * 1000,
	).toISOString();
	await c.env.DB.prepare(
		"UPDATE health_entries SET expires_at = ? WHERE user_id = ?",
	)
		.bind(newExpiresAt, userId)
		.run();

	return c.json({ dataRetentionDays });
});

export { settings };
