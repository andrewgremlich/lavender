// Reactive entries store using Svelte 5 runes. Decrypts server entries
// client-side and exposes them to components. Phase 6 replaced the
// window-event bridge with a direct `onSyncComplete` subscription.

import { metricsApi } from './api';
import { clearLegacyKey, decrypt, encrypt, getLegacyKey, getStoredKey, importKey } from './crypto';
import { metricsStore } from '$lib/services/metrics-store';
import { onSyncComplete, refreshFromServer, scheduleFlush } from '$lib/services/sync-engine';
import type { HealthEntryData } from '$lib/types';
import { calculateFertilityIndicators, toFertilityEntry } from '$lib/utils/fertility';
import type { FertilityIndicators } from '$lib/utils/fertility';

export type HealthEntry = HealthEntryData & { id: string };

interface EntriesState {
	entries: HealthEntry[];
	fertility: FertilityIndicators;
	loading: boolean;
	error: string | null;
}

const EMPTY_FERTILITY: FertilityIndicators = {
	ovulationDays: new Set(),
	fertileWindowDays: new Set(),
	cmFertileDays: new Set(),
	periodDays: new Set(),
	predictedPeriodDays: new Set(),
	predictedOvulationDays: new Set(),
	predictedFertileDays: new Set(),
	averageCycleLength: null,
	cycleVariability: null
};

const state = $state<EntriesState>({
	entries: [],
	fertility: EMPTY_FERTILITY,
	loading: false,
	error: null
});

let unsubscribeSync: (() => void) | null = null;

function recompute(entries: HealthEntry[]) {
	const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
	state.entries = sorted;
	state.fertility = calculateFertilityIndicators(sorted.map(toFertilityEntry));
}

async function decryptEntries(
	raw: { id: string; encryptedData: string; iv: string }[],
	cryptoKey: CryptoKey
): Promise<HealthEntry[]> {
	const legacyKeyBase64 = getLegacyKey();
	const legacyCryptoKey = legacyKeyBase64 ? await importKey(legacyKeyBase64) : null;

	const decryptedEntries: HealthEntry[] = [];
	for (const entry of raw) {
		try {
			const plaintext = await decrypt(entry.encryptedData, entry.iv, cryptoKey);
			decryptedEntries.push({ ...(JSON.parse(plaintext) as HealthEntryData), id: entry.id });
		} catch {
			// Try the legacy key (for accounts created under the old PBKDF2 salt)
			// and re-encrypt with the current key on success.
			if (!legacyCryptoKey) continue;
			try {
				const plaintext = await decrypt(entry.encryptedData, entry.iv, legacyCryptoKey);
				decryptedEntries.push({ ...(JSON.parse(plaintext) as HealthEntryData), id: entry.id });
				const { encrypted, iv } = await encrypt(plaintext, cryptoKey);
				await metricsApi.update(entry.id, encrypted, iv);
			} catch (err) {
				console.error('Decryption failed for entry', entry.id, err);
			}
		}
	}

	// Legacy key is only needed once per session for in-session migration.
	if (legacyKeyBase64) clearLegacyKey();

	return decryptedEntries;
}

export const entriesStore = {
	get entries() {
		return state.entries;
	},
	get fertility() {
		return state.fertility;
	},
	get loading() {
		return state.loading;
	},
	get error() {
		return state.error;
	},

	async load(): Promise<void> {
		const storedKey = getStoredKey();
		if (!storedKey) {
			state.error = 'Encryption key not found. Please log in again.';
			return;
		}

		state.loading = true;
		state.error = null;

		try {
			const cryptoKey = await importKey(storedKey);

			// Step 1: render from IDB cache immediately
			const cached = await metricsStore.getAll();
			if (cached.length > 0) {
				const decrypted = await decryptEntries(cached, cryptoKey);
				recompute(decrypted);
			}

			// Step 2: skip server refresh if there are pending mutations —
			// refreshFromServer wipes the cache, clobbering optimistic writes.
			// A sync-complete event will trigger another load() when the queue drains.
			const pending = await metricsStore.getQueue();
			if (pending.length > 0) {
				state.loading = false;
				return;
			}

			// Step 3: pull from server and re-render if the set of IDs changed
			const server = await refreshFromServer();
			const cacheIds = cached
				.map((e) => e.id)
				.sort()
				.join(',');
			const serverIds = server
				.map((e) => e.id)
				.sort()
				.join(',');
			if (cacheIds !== serverIds || cached.length === 0) {
				const decrypted = await decryptEntries(server, cryptoKey);
				recompute(decrypted);
			}
		} catch (err) {
			state.error = err instanceof Error ? err.message : 'Failed to load entries';
		} finally {
			state.loading = false;
		}
	},

	/** Subscribe to the sync engine so the store refreshes after each flush. */
	startSyncListener(): void {
		if (unsubscribeSync) return;
		unsubscribeSync = onSyncComplete(() => {
			void this.load();
		});
	},

	stopSyncListener(): void {
		unsubscribeSync?.();
		unsubscribeSync = null;
	},

	/** Optimistic create/update: write to IDB immediately and queue a server sync. */
	async saveEntry(entry: HealthEntryData, editId: string | null): Promise<void> {
		const storedKey = getStoredKey();
		if (!storedKey) throw new Error('Encryption key not found. Please log in again.');
		const cryptoKey = await importKey(storedKey);
		const { encrypted, iv } = await encrypt(JSON.stringify(entry), cryptoKey);

		const now = Date.now();
		const expiresAt = new Date(now + 180 * 24 * 60 * 60 * 1000).toISOString();

		if (editId) {
			await metricsStore.put({
				id: editId,
				encryptedData: encrypted,
				iv,
				createdAt: new Date().toISOString(),
				expiresAt
			});
			await metricsStore.enqueue({
				type: 'update',
				tempId: editId,
				serverId: editId,
				payload: { encryptedData: encrypted, iv },
				timestamp: now,
				retries: 0
			});
			// Replace in-memory
			const next = state.entries.map((e) => (e.id === editId ? { ...entry, id: editId } : e));
			recompute(next);
		} else {
			const tempId = crypto.randomUUID();
			await metricsStore.put({
				id: tempId,
				encryptedData: encrypted,
				iv,
				createdAt: new Date().toISOString(),
				expiresAt
			});
			await metricsStore.enqueue({
				type: 'create',
				tempId,
				payload: { encryptedData: encrypted, iv },
				timestamp: now,
				retries: 0
			});
			recompute([...state.entries, { ...entry, id: tempId }]);
		}

		scheduleFlush();
	},

	/** Optimistic delete: remove from IDB and queue a server delete. */
	async deleteEntry(id: string): Promise<void> {
		await metricsStore.remove(id);
		await metricsStore.enqueue({
			type: 'delete',
			tempId: id,
			serverId: id,
			timestamp: Date.now(),
			retries: 0
		});
		recompute(state.entries.filter((e) => e.id !== id));
		scheduleFlush();
	},

	/** Wipe all client-side state (used on logout). */
	clear(): void {
		state.entries = [];
		state.fertility = EMPTY_FERTILITY;
		state.error = null;
	}
};
