import type { Handle, HandleServerError } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { verifyJwt } from '$lib/server/jwt';
import type { Role } from '$lib/types';

/**
 * Rate limit: 100 requests per 15-minute window per IP, keyed in KV.
 * Applies only to unauthenticated `/api/*` routes — authenticated requests
 * (valid Bearer token) are exempt so bulk operations like seeding work.
 */
const RATE_LIMIT_WINDOW_SEC = 15 * 60;
const RATE_LIMIT_MAX = 100;

const handleAuth: Handle = async ({ event, resolve }) => {
	const header = event.request.headers.get('authorization');
	if (header?.startsWith('Bearer ')) {
		const secret = event.platform?.env?.JWT_SECRET;
		const db = event.platform?.env?.lavender_db;
		if (secret && db) {
			const payload = await verifyJwt(header.slice(7), secret);
			if (payload) {
				const epoch = typeof payload.epoch === 'number' ? payload.epoch : 0;
				const row = await db
					.prepare('SELECT token_epoch FROM users WHERE id = ?')
					.bind(payload.sub)
					.first<{ token_epoch: number }>();
				if (row && row.token_epoch === epoch) {
					event.locals.user = {
						userId: payload.sub,
						username: payload.username,
						role: ((payload.role as string) ?? 'user') as Role
					};
				}
			}
		}
	}
	return resolve(event);
};

const handleRateLimit: Handle = async ({ event, resolve }) => {
	if (!event.url.pathname.startsWith('/api/')) {
		return resolve(event);
	}

	// Authenticated requests are exempt — they've already proved identity via JWT.
	if (event.locals.user) {
		return resolve(event);
	}

	const kv = event.platform?.env?.RATE_LIMIT_KV;
	// If KV isn't bound (e.g. running outside workerd in tests), skip limiting.
	if (!kv) {
		return resolve(event);
	}

	const ip = event.request.headers.get('cf-connecting-ip') || 'unknown';
	const key = `rl:${ip}`;

	// Window state stored as `{ count, reset }` where `reset` is the unix-seconds
	// timestamp at which the current window expires.
	const now = Math.floor(Date.now() / 1000);
	const raw = await kv.get(key);
	let count = 0;
	let reset = now + RATE_LIMIT_WINDOW_SEC;
	if (raw) {
		try {
			const parsed = JSON.parse(raw) as { count: number; reset: number };
			if (parsed.reset > now) {
				count = parsed.count;
				reset = parsed.reset;
			}
		} catch {
			// corrupt entry; treat as fresh window
		}
	}

	if (count >= RATE_LIMIT_MAX) {
		return new Response(JSON.stringify({ error: 'Too many requests. Try again later.' }), {
			status: 429,
			headers: {
				'content-type': 'application/json',
				'retry-after': String(reset - now)
			}
		});
	}

	count += 1;
	// expirationTtl must be at least 60s for Cloudflare KV.
	const ttl = Math.max(60, reset - now);
	await kv.put(key, JSON.stringify({ count, reset }), { expirationTtl: ttl });

	return resolve(event);
};

const handleSecurityHeaders: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	return response;
};

export const handle: Handle = sequence(handleAuth, handleRateLimit, handleSecurityHeaders);

export const handleError: HandleServerError = ({ error, event }) => {
	console.error('Unhandled error on', event.url.pathname, error);
	return { message: 'Internal server error' };
};
