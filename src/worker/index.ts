import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { authMiddleware } from "./middleware/auth.js";
import { auth } from "./routes/auth.js";
import { metrics } from "./routes/metrics.js";
import { settings } from "./routes/settings.js";
import type { Env } from "./types.js";

const app = new Hono<{ Bindings: Env }>();

app.use("*", logger());
app.use("/api/*", cors({ origin: (origin) => origin }));

// Security headers
app.use("*", async (c, next) => {
	await next();
	c.header("X-Frame-Options", "DENY");
	c.header("X-Content-Type-Options", "nosniff");
	c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
	c.header("Referrer-Policy", "strict-origin-when-cross-origin");
	c.header(
		"Content-Security-Policy",
		"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'",
	);
});

// Global error handler
app.onError((err, c) => {
	console.error(err);
	return c.json({ error: "Internal server error" }, 500);
});

// Validate JWT_SECRET strength
app.use("/api/*", async (c, next) => {
	if (!c.env.JWT_SECRET || c.env.JWT_SECRET.length < 32) {
		console.error("JWT_SECRET must be at least 32 characters");
		return c.json({ error: "Internal server error" }, 500);
	}
	await next();
});

// API routes
app.route("/api/auth", auth);
app.route("/api/metrics", metrics);
app.route("/api/settings", settings);

// Health check
app.get("/api/health", (c) => c.json({ status: "ok" }));

// Cleanup expired entries (protected — requires auth)
app.get("/api/cleanup", authMiddleware(), async (c) => {
	const result = await c.env.lavender_db
		.prepare("DELETE FROM health_entries WHERE expires_at < datetime('now')")
		.run();

	return c.json({ deleted: result.meta.changes });
});

export default app;
