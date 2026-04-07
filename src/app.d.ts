// See https://svelte.dev/docs/kit/types#app
// for information about these interfaces

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			user?: { userId: string; username: string };
		}
		// interface PageData {}
		// interface PageState {}
		interface Platform {
			env: {
				lavender_db: D1Database;
				JWT_SECRET: string;
				RATE_LIMIT_KV: KVNamespace;
			};
			context: {
				waitUntil(promise: Promise<unknown>): void;
			};
			caches: CacheStorage & { default: Cache };
		}
	}
}

export {};
