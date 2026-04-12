<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { settingsApi } from '$lib/client/api';
	import { entriesStore } from '$lib/client/entries.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import ChartLegend from '$lib/components/charts/ChartLegend.svelte';
	import CycleCalendar from '$lib/components/display/CycleCalendar.svelte';
	import EntryCard from '$lib/components/display/EntryCard.svelte';
	import Logo from '$lib/components/layout/Logo.svelte';
	import MetricChart from '$lib/components/charts/MetricChart.svelte';
	import RangeSelector from '$lib/components/forms/RangeSelector.svelte';
	import Text from '$lib/components/ui/Text.svelte';
	import { _ } from 'svelte-i18n';

	type Range = '7' | '30' | 'all';

	const RANGE_STORAGE_KEY = 'lavender_default_date_range';

	function getStoredRange(): Range | null {
		if (!browser) return null;
		try {
			const stored = window.localStorage.getItem(RANGE_STORAGE_KEY);
			return stored === '7' || stored === '30' || stored === 'all' ? stored : null;
		} catch {
			return null;
		}
	}

	function storeRange(value: Range): void {
		if (!browser) return;
		try {
			window.localStorage.setItem(RANGE_STORAGE_KEY, value);
		} catch {
			// ignore local storage failures
		}
	}

	const legendItems = $derived([
		{ color: '#7c3aed', label: $_('dashboard.legend.bbt') },
		{
			color: 'rgba(245,158,11,0.6)',
			label: $_('dashboard.legend.lhSurge'),
			shape: 'square' as const
		},
		{ color: '#ec4899', label: $_('dashboard.legend.ovulation') },
		{ color: 'rgba(16,185,129,0.4)', label: $_('dashboard.legend.fertileWindow') },
		{
			color: 'rgba(244,114,182,0.5)',
			label: $_('dashboard.legend.indicators'),
			shape: 'square' as const
		}
	]);

	let range = $state<Range>(getStoredRange() ?? '30');

	$effect(() => {
		settingsApi
			.get()
			.then((s) => {
				if (
					s.defaultDateRange === '7' ||
					s.defaultDateRange === '30' ||
					s.defaultDateRange === 'all'
				) {
					range = s.defaultDateRange;
					storeRange(s.defaultDateRange);
				}
			})
			.catch(() => {});
	});

	function selectRange(next: Range) {
		range = next;
		storeRange(next);
		settingsApi.update({ defaultDateRange: next }).catch(() => {});
	}

	const filtered = $derived.by(() => {
		if (range === 'all') return entriesStore.entries;
		const days = Number.parseInt(range, 10);
		const cutoff = new Date();
		cutoff.setDate(cutoff.getDate() - days);
		const cutoffStr = cutoff.toISOString().split('T')[0];
		return entriesStore.entries.filter((e) => e.date >= cutoffStr);
	});

	const intimacyDays = $derived.by(() => {
		const map = new Map<string, 'unprotected' | 'protected'>();
		for (const e of entriesStore.entries) {
			if (e.intimacy) map.set(e.date, e.intimacy);
		}
		return map;
	});

	const recent = $derived(filtered.slice(-10).reverse());
</script>

<svelte:head>
	<title>{$_('dashboard.pageTitle')}</title>
</svelte:head>

<header class="dashboard-header">
	<Logo size="md" />
	<Text as="h2">{$_('dashboard.title')}</Text>
</header>

{#if entriesStore.loading && entriesStore.entries.length === 0}
	<Text variant="muted">{$_('dashboard.loading')}</Text>
{:else if entriesStore.error}
	<div class="error">{entriesStore.error}</div>
{:else if entriesStore.entries.length === 0}
	<div class="empty">
		<Text as="h3">{$_('dashboard.noDataYet')}</Text>
		<p>{$_('dashboard.noDataDescription')}</p>
		<Button type="button" onclick={() => goto('/app/entry')}>{$_('dashboard.addFirstEntry')}</Button
		>
	</div>
{:else}
	<RangeSelector value={range} onselect={selectRange} />

	<MetricChart entries={filtered} fertility={entriesStore.fertility} />
	<ChartLegend items={legendItems} />

	<section class="calendar-section">
		<CycleCalendar fertility={entriesStore.fertility} {intimacyDays} view={range === '7' ? 'week' : 'month'} />
	</section>

	<section class="entries">
		<Text as="h3">{$_('dashboard.recentEntries')}</Text>
		{#if recent.length === 0}
			<Text variant="muted">{$_('dashboard.noEntriesInRange')}</Text>
		{:else}
			{#each recent as entry (entry.id)}
				<EntryCard {entry} />
			{/each}
		{/if}
	</section>
{/if}

<style>
	.dashboard-header {
		display: flex;
		align-items: center;
		gap: var(--space-md);
		margin-bottom: var(--space-md);
	}

	.dashboard-header :global(h2) {
		margin: 0;
	}

	.error {
		padding: var(--space-md);
		background: var(--color-error-bg);
		color: var(--color-error);
		border: 1px solid var(--color-error);
		border-radius: var(--radius-md);
	}

	.empty {
		text-align: center;
		padding: var(--space-xl);
		background: var(--color-surface);
		border: 1px dashed var(--color-border);
		border-radius: var(--radius-lg);
	}

	.empty :global(h3) {
		margin-bottom: var(--space-sm);
	}

	.empty p {
		color: var(--color-text-muted);
		margin-bottom: var(--space-md);
	}

	.calendar-section {
		margin: var(--space-lg) 0;
	}

	.entries {
		margin-top: var(--space-lg);
	}

	.entries :global(h3) {
		margin-bottom: var(--space-md);
	}
</style>
