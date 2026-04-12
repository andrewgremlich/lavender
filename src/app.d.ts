// See https://svelte.dev/docs/kit/types#app
// for information about these interfaces

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			user?: { userId: string; username: string; role: 'user' | 'demo' | 'admin' | 'banned' };
		}
		// interface PageData {}
		// interface PageState {}
		interface Platform {
			env: {
				lavender_db: D1Database;
				JWT_SECRET: string;
				RATE_LIMIT_KV: KVNamespace;
				DEMO_PASSWORD: string;
				TURNSTILE_SECRET_KEY: string;
			};
			context: {
				waitUntil(promise: Promise<unknown>): void;
			};
			caches: CacheStorage & { default: Cache };
		}
	}
}

export {};
