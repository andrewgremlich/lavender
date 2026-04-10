<script lang="ts">
	import { goto } from '$app/navigation';
	import { authApi, metricsApi } from '$lib/client/api';
	import { auth } from '$lib/client/auth.svelte';
	import { entriesStore } from '$lib/client/entries.svelte';
	import { metricsStore } from '$lib/services/metrics-store';
	import { _ } from 'svelte-i18n';
	import Button from '$lib/components/ui/Button.svelte';
	import SettingsCard from '$lib/components/layout/SettingsCard.svelte';

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
			alert(
				$_('settings.dangerZone.operationFailed', {
					values: { error: err instanceof Error ? err.message : 'Unknown error' }
				})
			);
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
			alert(
				$_('settings.dangerZone.operationFailed', {
					values: { error: err instanceof Error ? err.message : 'Unknown error' }
				})
			);
		}
	}
</script>

<SettingsCard title={$_('settings.dangerZone.title')} danger>
	<div class="danger-actions">
		{#if !confirmDeleteData}
			<Button variant="danger-outline" type="button" onclick={() => (confirmDeleteData = true)}>
				{$_('settings.dangerZone.deleteData')}
			</Button>
		{:else}
			<div class="confirm">
				<p>{$_('settings.dangerZone.confirmDeleteData')}</p>
				<div class="confirm-actions">
					<Button variant="danger" type="button" onclick={deleteAllData}
						>{$_('settings.dangerZone.yesDeleteData')}</Button
					>
					<Button variant="outline" type="button" onclick={() => (confirmDeleteData = false)}
						>{$_('settings.dangerZone.cancel')}</Button
					>
				</div>
			</div>
		{/if}
		{#if dataDeleted}
			<p class="deleted">{$_('settings.dangerZone.dataDeleted')}</p>
		{/if}

		{#if !confirmDeleteAccount}
			<Button variant="danger" type="button" onclick={() => (confirmDeleteAccount = true)}>
				{$_('settings.dangerZone.deleteAccount')}
			</Button>
		{:else}
			<div class="confirm">
				<p>{$_('settings.dangerZone.confirmDeleteAccount')}</p>
				<div class="confirm-actions">
					<Button variant="danger" type="button" onclick={deleteAccount}
						>{$_('settings.dangerZone.yesDeleteAccount')}</Button
					>
					<Button variant="outline" type="button" onclick={() => (confirmDeleteAccount = false)}
						>{$_('settings.dangerZone.cancel')}</Button
					>
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
