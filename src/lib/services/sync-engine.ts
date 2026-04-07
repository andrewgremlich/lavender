// Offline-first sync engine: flushes queued mutations to the server and
// refreshes the local cache from the authoritative server copy.
// Ported from legacy/src/client/services/sync-engine.ts. Events are dispatched
// on window; Phase 6 will bridge these into reactive stores.

import { metricsApi } from '$lib/client/api';
import type { EncryptedEntry } from '$lib/types';
import { metricsStore } from './metrics-store';

export type SyncStatus = 'synced' | 'pending' | 'error';

let status: SyncStatus = 'synced';
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;

function setStatus(next: SyncStatus) {
	status = next;
	window.dispatchEvent(new CustomEvent('sync-status-change', { detail: { status } }));
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
		window.dispatchEvent(new CustomEvent('sync-complete'));
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

export const syncEngine = {
	init() {
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
