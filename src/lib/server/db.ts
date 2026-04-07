import { error } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

/**
 * Extracts the D1 binding and JWT secret from the Cloudflare platform object.
 * Throws a 500 if the platform is missing (i.e. running outside workerd) or
 * if JWT_SECRET is misconfigured.
 */
export function getPlatform(event: RequestEvent) {
	const platform = event.platform;
	if (!platform) {
		console.error('platform.env is unavailable (running outside workerd?)');
		throw error(500, 'Server misconfigured');
	}
	const env = platform.env;
	if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) {
		console.error('JWT_SECRET must be at least 32 characters');
		throw error(500, 'Server misconfigured');
	}
	return { db: env.lavender_db, jwtSecret: env.JWT_SECRET, env };
}
