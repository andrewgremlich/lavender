/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />
/// <reference types="@sveltejs/kit" />

import { build, files, version } from '$service-worker';

const self = globalThis.self as unknown as ServiceWorkerGlobalScope;

const CACHE = `cache-${version}`;
const ASSETS = [...build, ...files];

// SyncEvent is not in the default TS lib — declare it for background sync.
interface SyncEvent extends ExtendableEvent {
	readonly tag: string;
}

self.addEventListener('install', (event) => {
	async function addFilesToCache() {
		const cache = await caches.open(CACHE);
		await cache.addAll(ASSETS);
	}
	event.waitUntil(addFilesToCache());
});

self.addEventListener('activate', (event) => {
	async function deleteOldCaches() {
		for (const key of await caches.keys()) {
			if (key !== CACHE) await caches.delete(key);
		}
	}
	event.waitUntil(deleteOldCaches());

	// Notify clients when a new SW version activates
	event.waitUntil(
		self.clients.matchAll().then((clients) => {
			for (const client of clients) {
				client.postMessage({ type: 'SW_UPDATED' });
			}
		})
	);
});

self.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return;

	async function respond() {
		const url = new URL(event.request.url);
		const cache = await caches.open(CACHE);

		// Build/static assets — always serve from cache
		if (ASSETS.includes(url.pathname)) {
			const cached = await cache.match(url.pathname);
			if (cached) return cached;
		}

		// Skip caching API requests — dynamic data must stay fresh
		if (url.pathname.startsWith('/api/')) {
			return fetch(event.request);
		}

		// Everything else: network-first, fall back to cache when offline
		try {
			const response = await fetch(event.request);

			if (!(response instanceof Response)) {
				throw new Error('invalid response from fetch');
			}

			if (response.status === 200) {
				cache.put(event.request, response.clone());
			}

			return response;
		} catch {
			const cached = await cache.match(event.request);
			if (cached) return cached;

			throw new Error('offline and no cache available');
		}
	}

	event.respondWith(respond());
});

// Background sync: when the browser fires a `sync` event (Chrome/Edge),
// notify all open clients so the app-level sync engine can flush its queue.
self.addEventListener('sync', (event) => {
	const syncEvent = event as SyncEvent;
	if (syncEvent.tag === 'metrics-sync') {
		syncEvent.waitUntil(
			self.clients.matchAll().then((clients) => {
				for (const client of clients) {
					client.postMessage({ type: 'TRIGGER_SYNC' });
				}
			})
		);
	}
});
