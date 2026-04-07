// Reactive wrapper around the sync engine. Subscribes to the engine's
// `onStatusChange` callback on module load so any component reading
// `sync.status` updates automatically — no window event plumbing.

import { getSyncStatus, onStatusChange, type SyncStatus } from '$lib/services/sync-engine';

interface SyncState {
	status: SyncStatus;
}

const state = $state<SyncState>({ status: getSyncStatus() });

onStatusChange((next) => {
	state.status = next;
});

export const sync = {
	get status() {
		return state.status;
	}
};
