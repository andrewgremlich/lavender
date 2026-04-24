import type { Handle, HandleServerError } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { verifyJwt } from '$lib/server/jwt';
import type { Role } from '$lib/types';

const RATE_LIMIT_WINDOW_SEC = 15 * 60;
const RATE_LIMIT_MAX = 100;
// Stricter limits for auth endpoints — prevents credential brute-force and recovery code guessing.
const AUTH_RATE_LIMIT_MAX = 10;
const AUTH_RATE_LIMIT_PATHS = new Set([
	'/api/auth/login',
	'/api/auth/recovery-start',
	'/api/auth/demo-login'
]);
// Authenticated users get a softer limit — prevents compute abuse even with a valid JWT.
const AUTHED_RATE_LIMIT_MAX = 300;

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

	const kv = event.platform?.env?.RATE_LIMIT_KV;
	// If KV isn't bound (e.g. running outside workerd in tests), skip limiting.
	if (!kv) {
		return resolve(event);
	}

	const ip = event.request.headers.get('cf-connecting-ip') || 'unknown';
	let key: string;
	let limit: number;
	if (event.locals.user) {
		key = `rl:user:${event.locals.user.userId}`;
		limit = AUTHED_RATE_LIMIT_MAX;
	} else {
		const isAuthEndpoint = AUTH_RATE_LIMIT_PATHS.has(event.url.pathname);
		key = isAuthEndpoint ? `rl:auth:${ip}` : `rl:${ip}`;
		limit = isAuthEndpoint ? AUTH_RATE_LIMIT_MAX : RATE_LIMIT_MAX;
	}

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

	if (count >= limit) {
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
	response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
	response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
	response.headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
	return response;
};

export const handle: Handle = sequence(handleAuth, handleRateLimit, handleSecurityHeaders);

export const handleError: HandleServerError = ({ error, event }) => {
	console.error('Unhandled error on', event.url.pathname, error);
	return { message: 'Internal server error' };
};
