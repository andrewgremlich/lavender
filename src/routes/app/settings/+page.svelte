<script lang="ts">
	import { goto } from '$app/navigation';
	import { settingsApi } from '$lib/client/api';
	import { auth } from '$lib/client/auth.svelte';
	import { entriesStore } from '$lib/client/entries.svelte';
	import { SUPPORTED_LOCALES, getStoredLocale, storeLocale, type SupportedLocale } from '$lib/i18n';
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
	import { _, locale } from 'svelte-i18n';

	let unitSystem = $state<UnitSystem>(getUnitSystem());
	let retentionDays = $state(180);
	let language = $state<SupportedLocale>(getStoredLocale());
	let unitsMsg = $state<{ text: string; type: 'success' | 'error' } | null>(null);
	let retentionMsg = $state<{ text: string; type: 'success' | 'error' } | null>(null);
	let languageMsg = $state<{ text: string; type: 'success' | 'error' } | null>(null);

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
		flash((m) => (unitsMsg = m), $_('settings.units.saved'), 'success');
	}

	async function saveRetention() {
		try {
			await settingsApi.update({ dataRetentionDays: retentionDays });
			flash((m) => (retentionMsg = m), $_('settings.retention.saved'), 'success');
		} catch (err) {
			flash(
				(m) => (retentionMsg = m),
				err instanceof Error ? err.message : $_('settings.retention.saveFailed'),
				'error'
			);
		}
	}

	function saveLanguage() {
		storeLocale(language);
		locale.set(language);
		flash((m) => (languageMsg = m), $_('settings.language.saved'), 'success');
	}

	async function logout() {
		await metricsStore.clearCache();
		entriesStore.clear();
		auth.logout();
		goto('/auth/login', { replaceState: true });
	}
</script>

<svelte:head>
	<title>{$_('settings.pageTitle')}</title>
</svelte:head>

<div class="header">
	<Text as="h2">{$_('settings.title')}</Text>
	<Button variant="outline" type="button" onclick={logout}>{$_('settings.logOut')}</Button>
</div>

<SettingsCard title={$_('settings.units.title')}>
	<label for="unit-system">{$_('settings.units.label')}</label>
	<select id="unit-system" bind:value={unitSystem}>
		<option value="metric">{$_('settings.units.metric')}</option>
		<option value="us">{$_('settings.units.us')}</option>
	</select>
	<Button type="button" onclick={saveUnits}>{$_('common.save')}</Button>
	<FlashMessage message={unitsMsg} />
</SettingsCard>

<SettingsCard title={$_('settings.retention.title')}>
	<label for="retention">{$_('settings.retention.label')}</label>
	<select id="retention" bind:value={retentionDays}>
		<option value={180}>{$_('settings.retention.6months')}</option>
		<option value={270}>{$_('settings.retention.9months')}</option>
		<option value={365}>{$_('settings.retention.1year')}</option>
	</select>
	<Button type="button" onclick={saveRetention}>{$_('common.save')}</Button>
	<FlashMessage message={retentionMsg} />
</SettingsCard>

<SettingsCard title={$_('settings.language.title')}>
	<label for="language">{$_('settings.language.label')}</label>
	<select id="language" bind:value={language}>
		{#each SUPPORTED_LOCALES as loc (loc.value)}
			<option value={loc.value}>{loc.label}</option>
		{/each}
	</select>
	<Button type="button" onclick={saveLanguage}>{$_('common.save')}</Button>
	<FlashMessage message={languageMsg} />
</SettingsCard>

<ExportSection />
<ImportSection />
{#if !auth.isDemo}
	<ChangePasswordSection />
	<DangerZoneSection />
{:else}
	<SettingsCard title="Account">
		<Text variant="muted">
			Password and account management are not available in guest mode.
			<a href="/auth/register">Create an account</a> to access these features.
		</Text>
	</SettingsCard>
{/if}

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
