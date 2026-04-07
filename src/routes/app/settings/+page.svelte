<script lang="ts">
	import { goto } from '$app/navigation';
	import { settingsApi } from '$lib/client/api';
	import { auth } from '$lib/client/auth.svelte';
	import { entriesStore } from '$lib/client/entries.svelte';
	import { metricsStore } from '$lib/services/metrics-store';
	import { getUnitSystem, setUnitSystem, type UnitSystem } from '$lib/utils/units';
	import Button from '$lib/components/Button.svelte';
	import FlashMessage from '$lib/components/FlashMessage.svelte';
	import SettingsCard from '$lib/components/SettingsCard.svelte';
	import Text from '$lib/components/Text.svelte';
	import ExportSection from '$lib/components/ExportSection.svelte';
	import ImportSection from '$lib/components/ImportSection.svelte';
	import ChangePasswordSection from '$lib/components/ChangePasswordSection.svelte';
	import DangerZoneSection from '$lib/components/DangerZoneSection.svelte';

	let unitSystem = $state<UnitSystem>(getUnitSystem());
	let retentionDays = $state(180);
	let unitsMsg = $state<{ text: string; type: 'success' | 'error' } | null>(null);
	let retentionMsg = $state<{ text: string; type: 'success' | 'error' } | null>(null);

	$effect(() => {
		settingsApi
			.get()
			.then((s) => {
				retentionDays = s.dataRetentionDays;
			})
			.catch(() => {});
	});

	function flash(
		setter: (m: { text: string; type: 'success' | 'error' } | null) => void,
		text: string,
		type: 'success' | 'error'
	) {
		setter({ text, type });
		setTimeout(() => setter(null), 4000);
	}

	function saveUnits() {
		setUnitSystem(unitSystem);
		flash((m) => (unitsMsg = m), 'Unit preference saved.', 'success');
	}

	async function saveRetention() {
		try {
			await settingsApi.update({ dataRetentionDays: retentionDays });
			flash((m) => (retentionMsg = m), 'Retention period saved.', 'success');
		} catch (err) {
			flash(
				(m) => (retentionMsg = m),
				err instanceof Error ? err.message : 'Failed to save.',
				'error'
			);
		}
	}

	async function logout() {
		await metricsStore.clearCache();
		entriesStore.clear();
		auth.logout();
		goto('/auth/login', { replaceState: true });
	}
</script>

<svelte:head>
	<title>Settings — Lavender</title>
</svelte:head>

<div class="header">
	<Text as="h2">Settings</Text>
	<Button variant="outline" type="button" onclick={logout}>Log Out</Button>
</div>

<SettingsCard title="Units">
	<label for="unit-system">Measurement system</label>
	<select id="unit-system" bind:value={unitSystem}>
		<option value="metric">Metric (°C, kg, cm)</option>
		<option value="us">US (°F, lb, in)</option>
	</select>
	<Button type="button" onclick={saveUnits}>Save</Button>
	<FlashMessage message={unitsMsg} />
</SettingsCard>

<SettingsCard title="Data Retention">
	<label for="retention">Auto-delete entries older than</label>
	<select id="retention" bind:value={retentionDays}>
		<option value={180}>6 months</option>
		<option value={270}>9 months</option>
		<option value={365}>1 year</option>
	</select>
	<Button type="button" onclick={saveRetention}>Save</Button>
	<FlashMessage message={retentionMsg} />
</SettingsCard>

<ExportSection />
<ImportSection />
<ChangePasswordSection />
<DangerZoneSection />

<style>
	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: var(--space-md);
	}

	label {
		font-size: var(--text-sm);
		font-weight: 500;
	}

	select {
		padding: 0.625rem 0.75rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-text);
		font-size: var(--text-base);
	}

	select:focus {
		outline: none;
		border-color: var(--color-border-focus);
		box-shadow: 0 0 0 3px var(--color-primary-alpha);
	}
</style>
