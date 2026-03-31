import { Hono } from "hono";
import type { EncryptedEntry } from "../../shared/types.js";
import { generateId } from "../crypto.js";
import { authMiddleware, getUserId } from "../middleware/auth.js";
import type { Env, HealthEntryRow } from "../types.js";

const metrics = new Hono<{ Bindings: Env }>();

metrics.use("/*", authMiddleware());

// Get all entries for user
metrics.get("/", async (c) => {
	const userId = getUserId(c);

	// Clean up expired entries first
	await c.env.lavender_db
		.prepare(
			"DELETE FROM health_entries WHERE user_id = ? AND expires_at < datetime('now')",
		)
		.bind(userId)
		.run();

	const rows = await c.env.lavender_db
		.prepare(
			"SELECT * FROM health_entries WHERE user_id = ? ORDER BY created_at DESC",
		)
		.bind(userId)
		.all<HealthEntryRow>();

	const entries: EncryptedEntry[] = (rows.results || []).map((row) => ({
		id: row.id,
		encryptedData: row.encrypted_data,
		iv: row.iv,
		createdAt: row.created_at,
		expiresAt: row.expires_at,
	}));

	return c.json(entries);
});

// Create entry
metrics.post("/", async (c) => {
	const userId = getUserId(c);
	const { encryptedData, iv } = await c.req.json<{
		encryptedData: string;
		iv: string;
	}>();

	if (!encryptedData || !iv) {
		return c.json({ error: "Encrypted data and IV required" }, 400);
	}

	if (encryptedData.length > 100000 || iv.length > 100) {
		return c.json({ error: "Payload too large" }, 413);
	}

	// Get user's retention setting
	const settings = await c.env.lavender_db
		.prepare("SELECT data_retention_days FROM user_settings WHERE user_id = ?")
		.bind(userId)
		.first<{ data_retention_days: number }>();

	const retentionDays = settings?.data_retention_days ?? 180;
	const id = generateId();
	const expiresAt = new Date(
		Date.now() + retentionDays * 24 * 60 * 60 * 1000,
	).toISOString();

	await c.env.lavender_db
		.prepare(
			"INSERT INTO health_entries (id, user_id, encrypted_data, iv, expires_at) VALUES (?, ?, ?, ?, ?)",
		)
		.bind(id, userId, encryptedData, iv, expiresAt)
		.run();

	return c.json({ id, createdAt: new Date().toISOString(), expiresAt }, 201);
});

// Update entry
metrics.put("/:id", async (c) => {
	const userId = getUserId(c);
	const entryId = c.req.param("id");
	const { encryptedData, iv } = await c.req.json<{
		encryptedData: string;
		iv: string;
	}>();

	if (!encryptedData || !iv) {
		return c.json({ error: "Encrypted data and IV required" }, 400);
	}

	if (encryptedData.length > 100000 || iv.length > 100) {
		return c.json({ error: "Payload too large" }, 413);
	}

	const existing = await c.env.lavender_db
		.prepare("SELECT id FROM health_entries WHERE id = ? AND user_id = ?")
		.bind(entryId, userId)
		.first();

	if (!existing) {
		return c.json({ error: "Entry not found" }, 404);
	}

	await c.env.lavender_db
		.prepare(
			"UPDATE health_entries SET encrypted_data = ?, iv = ? WHERE id = ? AND user_id = ?",
		)
		.bind(encryptedData, iv, entryId, userId)
		.run();

	return c.json({ message: "Updated" });
});

// Delete entry
metrics.delete("/:id", async (c) => {
	const userId = getUserId(c);
	const entryId = c.req.param("id");

	await c.env.lavender_db
		.prepare("DELETE FROM health_entries WHERE id = ? AND user_id = ?")
		.bind(entryId, userId)
		.run();

	return c.json({ message: "Deleted" });
});

// Bulk delete all entries
metrics.delete("/", async (c) => {
	const userId = getUserId(c);

	await c.env.lavender_db
		.prepare("DELETE FROM health_entries WHERE user_id = ?")
		.bind(userId)
		.run();

	return c.json({ message: "All entries deleted" });
});

export { metrics };
