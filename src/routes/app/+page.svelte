<script lang="ts">
	import { goto } from '$app/navigation';
	import { settingsApi } from '$lib/client/api';
	import { entriesStore } from '$lib/client/entries.svelte';
	import Button from '$lib/components/Button.svelte';
	import ChartLegend from '$lib/components/ChartLegend.svelte';
	import CycleCalendar from '$lib/components/CycleCalendar.svelte';
	import EntryCard from '$lib/components/EntryCard.svelte';
	import MetricChart from '$lib/components/MetricChart.svelte';
	import RangeSelector from '$lib/components/RangeSelector.svelte';
	import Text from '$lib/components/Text.svelte';

	type Range = '7' | '30' | 'all';

	const legendItems = [
		{ color: '#7c3aed', label: 'BBT' },
		{ color: 'rgba(245,158,11,0.6)', label: 'LH Surge', shape: 'square' as const },
		{ color: '#ec4899', label: 'Ovulation' },
		{ color: 'rgba(16,185,129,0.4)', label: 'Fertile Window' },
		{ color: 'rgba(244,114,182,0.5)', label: 'Indicators', shape: 'square' as const }
	];

	let range = $state<Range>('30');

	$effect(() => {
		settingsApi
			.get()
			.then((s) => {
				if (s.defaultDateRange === '7' || s.defaultDateRange === '30' || s.defaultDateRange === 'all') {
					range = s.defaultDateRange;
				}
			})
			.catch(() => {});
	});

	function selectRange(next: Range) {
		range = next;
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

	const recent = $derived(filtered.slice(-10).reverse());
</script>

<svelte:head>
	<title>Dashboard — Lavender</title>
</svelte:head>

<Text as="h2">Dashboard</Text>

{#if entriesStore.loading && entriesStore.entries.length === 0}
	<Text variant="muted">Loading your data…</Text>
{:else if entriesStore.error}
	<div class="error">{entriesStore.error}</div>
{:else if entriesStore.entries.length === 0}
	<div class="empty">
		<Text as="h3">No Data Yet</Text>
		<p>Start tracking your health metrics to see trends and insights.</p>
		<Button type="button" onclick={() => goto('/app/entry')}>Add Your First Entry</Button>
	</div>
{:else}
	<RangeSelector value={range} onselect={selectRange} />

	<MetricChart entries={filtered} fertility={entriesStore.fertility} />
	<ChartLegend items={legendItems} />

	<section class="calendar-section">
		<CycleCalendar fertility={entriesStore.fertility} view={range === '7' ? 'week' : 'month'} />
	</section>

	<section class="entries">
		<Text as="h3">Recent Entries</Text>
		{#if recent.length === 0}
			<Text variant="muted">No entries in this range.</Text>
		{:else}
			{#each recent as entry (entry.id)}
				<EntryCard {entry} />
			{/each}
		{/if}
	</section>
{/if}

<style>
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
