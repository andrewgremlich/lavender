import type { Context, Next } from "hono";
import type { Env } from "../types.js";

const windowMs = 15 * 60 * 1000; // 15 minutes
const maxRequests = 20;

const requests = new Map<string, number[]>();

function cleanup() {
	const now = Date.now();
	for (const [key, timestamps] of requests) {
		const valid = timestamps.filter((t) => now - t < windowMs);
		if (valid.length === 0) {
			requests.delete(key);
		} else {
			requests.set(key, valid);
		}
	}
}

export function rateLimiter() {
	return async (c: Context<{ Bindings: Env }>, next: Next) => {
		const ip = c.req.header("cf-connecting-ip") || "unknown";
		const now = Date.now();

		// Periodic cleanup
		if (Math.random() < 0.05) cleanup();

		const timestamps = requests.get(ip) || [];
		const recentTimestamps = timestamps.filter((t) => now - t < windowMs);

		if (recentTimestamps.length >= maxRequests) {
			return c.json({ error: "Too many requests. Try again later." }, 429);
		}

		recentTimestamps.push(now);
		requests.set(ip, recentTimestamps);

		await next();
	};
}
