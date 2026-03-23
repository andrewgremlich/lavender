import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { auth } from "./routes/auth.js";
import { metrics } from "./routes/metrics.js";
import { settings } from "./routes/settings.js";
import type { Env } from "./types.js";

const app = new Hono<{ Bindings: Env }>();

app.use("*", logger());
app.use("/api/*", cors());

// API routes
app.route("/api/auth", auth);
app.route("/api/metrics", metrics);
app.route("/api/settings", settings);

// Health check
app.get("/api/health", (c) => c.json({ status: "ok" }));

// Cleanup expired entries (can be called via cron trigger)
app.get("/api/cleanup", async (c) => {
	const result = await c.env.DB.prepare(
		"DELETE FROM health_entries WHERE expires_at < datetime('now')",
	).run();

	return c.json({ deleted: result.meta.changes });
});

export default app;
