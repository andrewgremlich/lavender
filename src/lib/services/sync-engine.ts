// Offline-first sync engine: flushes queued mutations to the server and
// refreshes the local cache from the authoritative server copy.
//
// Originally ported from the legacy module in Phase 5. Phase 6 replaced the
// window-event bridge with a direct subscription API: callers register
// listeners via `onStatusChange` / `onSyncComplete` and Svelte reactive
// stores wrap those subscriptions (see `$lib/client/sync.svelte.ts` and
// `$lib/client/entries.svelte.ts`).

import { metricsApi } from '$lib/client/api';
import type { EncryptedEntry } from '$lib/types';
import { metricsStore } from './metrics-store';

export type SyncStatus = 'synced' | 'pending' | 'error';

let status: SyncStatus = 'synced';
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;

type StatusListener = (status: SyncStatus) => void;
type CompleteListener = () => void;

const statusListeners = new Set<StatusListener>();
const completeListeners = new Set<CompleteListener>();

export function onStatusChange(listener: StatusListener): () => void {
	statusListeners.add(listener);
	return () => statusListeners.delete(listener);
}

export function onSyncComplete(listener: CompleteListener): () => void {
	completeListeners.add(listener);
	return () => completeListeners.delete(listener);
}

function setStatus(next: SyncStatus) {
	if (status === next) return;
	status = next;
	for (const listener of statusListeners) listener(status);
}

function emitComplete() {
	for (const listener of completeListeners) listener();
}

export function getSyncStatus(): SyncStatus {
	return status;
}

export async function refreshFromServer(): Promise<EncryptedEntry[]> {
	try {
		const serverEntries = await metricsApi.getAll();
		await metricsStore.clearEntriesOnly();
		for (const entry of serverEntries) {
			await metricsStore.put(entry);
		}
		return serverEntries;
	} catch {
		return metricsStore.getAll();
	}
}

export async function flush(): Promise<void> {
	if (flushing) return;
	flushing = true;

	try {
		const queue = await metricsStore.getQueue();
		if (queue.length === 0) {
			setStatus('synced');
			return;
		}

		setStatus('pending');

		// Cancel paired create+delete for same tempId (optimistic write then delete).
		const createItems = queue.filter((i) => i.type === 'create');
		const deleteItems = queue.filter((i) => i.type === 'delete');
		const cancelledTempIds = new Set<string>();

		for (const c of createItems) {
			const paired = deleteItems.find((d) => d.tempId === c.tempId && d.id != null && c.id != null);
			if (paired && c.id != null && paired.id != null) {
				cancelledTempIds.add(c.tempId);
				await metricsStore.dequeue(c.id);
				await metricsStore.dequeue(paired.id);
				await metricsStore.remove(c.tempId);
			}
		}

		const remaining = await metricsStore.getQueue();

		for (const item of remaining) {
			if (cancelledTempIds.has(item.tempId)) continue;

			try {
				if (item.type === 'create' && item.payload) {
					const result = await metricsApi.create(item.payload.encryptedData, item.payload.iv);
					const realId = result.id;

					await metricsStore.remove(item.tempId);
					await metricsStore.put({
						id: realId,
						encryptedData: item.payload.encryptedData,
						iv: item.payload.iv,
						createdAt: result.createdAt,
						expiresAt: result.expiresAt
					});

					await metricsStore.updateQueueServerId(item.tempId, realId);
					if (item.id != null) await metricsStore.dequeue(item.id);
				} else if (item.type === 'update' && item.payload && item.serverId) {
					await metricsApi.update(item.serverId, item.payload.encryptedData, item.payload.iv);
					if (item.id != null) await metricsStore.dequeue(item.id);
				} else if (item.type === 'delete' && item.serverId) {
					await metricsApi.delete(item.serverId);
					if (item.id != null) await metricsStore.dequeue(item.id);
				}
			} catch {
				if (item.id != null) {
					const { id: _oldId, ...rest } = item;
					void _oldId;
					await metricsStore.enqueue({
						...rest,
						retries: item.retries + 1
					});
					await metricsStore.dequeue(item.id);
				}
				setStatus('error');
				return;
			}
		}

		const leftover = await metricsStore.getQueue();
		setStatus(leftover.length === 0 ? 'synced' : 'pending');
		emitComplete();
	} finally {
		flushing = false;
	}
}

export function scheduleFlush(delayMs = 0): void {
	setStatus('pending');
	if (flushTimer != null) clearTimeout(flushTimer);
	flushTimer = setTimeout(() => {
		flushTimer = null;
		if (navigator.onLine) flush();
	}, delayMs);
}

let inited = false;

export const syncEngine = {
	init() {
		if (inited) return;
		inited = true;

		window.addEventListener('online', () => {
			flush();
		});

		navigator.serviceWorker?.addEventListener('message', (event) => {
			if (event.data?.type === 'TRIGGER_SYNC') {
				flush();
			}
		});

		metricsStore.getQueue().then((q) => {
			if (q.length > 0) setStatus('pending');
		});
	}
};
