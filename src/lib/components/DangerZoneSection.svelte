<script lang="ts">
	import { goto } from '$app/navigation';
	import { authApi, metricsApi } from '$lib/client/api';
	import { auth } from '$lib/client/auth.svelte';
	import { entriesStore } from '$lib/client/entries.svelte';
	import { metricsStore } from '$lib/services/metrics-store';
	import Button from './Button.svelte';
	import SettingsCard from './SettingsCard.svelte';

	let confirmDeleteData = $state(false);
	let confirmDeleteAccount = $state(false);
	let dataDeleted = $state(false);

	async function deleteAllData() {
		try {
			await metricsApi.deleteAll();
			await metricsStore.clearCache();
			entriesStore.clear();
			dataDeleted = true;
			confirmDeleteData = false;
		} catch (err) {
			alert(`Operation failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
		}
	}

	async function deleteAccount() {
		try {
			await authApi.deleteAccount();
			await metricsStore.clearCache();
			entriesStore.clear();
			auth.logout();
			goto('/auth/login', { replaceState: true });
		} catch (err) {
			alert(`Operation failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
		}
	}
</script>

<SettingsCard title="Danger Zone" danger>
	<div class="danger-actions">
		{#if !confirmDeleteData}
			<Button variant="danger-outline" type="button" onclick={() => (confirmDeleteData = true)}>
				Delete All Data
			</Button>
		{:else}
			<div class="confirm">
				<p>This will permanently delete all your health entries. This action cannot be undone.</p>
				<div class="confirm-actions">
					<Button variant="danger" type="button" onclick={deleteAllData}>Yes, Delete All Data</Button>
					<Button variant="outline" type="button" onclick={() => (confirmDeleteData = false)}>Cancel</Button>
				</div>
			</div>
		{/if}
		{#if dataDeleted}
			<p class="deleted">All data deleted.</p>
		{/if}

		{#if !confirmDeleteAccount}
			<Button variant="danger" type="button" onclick={() => (confirmDeleteAccount = true)}>
				Delete Account
			</Button>
		{:else}
			<div class="confirm">
				<p>This will permanently delete your account and all associated data. This cannot be undone.</p>
				<div class="confirm-actions">
					<Button variant="danger" type="button" onclick={deleteAccount}>Yes, Delete My Account</Button>
					<Button variant="outline" type="button" onclick={() => (confirmDeleteAccount = false)}>Cancel</Button>
				</div>
			</div>
		{/if}
	</div>
</SettingsCard>

<style>
	.danger-actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-sm);
	}

	.confirm {
		background: var(--color-error-bg);
		padding: var(--space-md);
		border-radius: var(--radius-md);
	}

	.confirm-actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-sm);
		margin-top: var(--space-sm);
	}

	.deleted {
		color: var(--color-success);
		font-size: var(--text-sm);
	}
</style>
