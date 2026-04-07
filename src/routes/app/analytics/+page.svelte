<script lang="ts">
	import { entriesStore } from '$lib/client/entries.svelte';
	import AccuracyChart from '$lib/components/AccuracyChart.svelte';
	import Button from '$lib/components/Button.svelte';
	import ComparisonChart from '$lib/components/ComparisonChart.svelte';
	import LutealChart from '$lib/components/LutealChart.svelte';
	import StatCard from '$lib/components/StatCard.svelte';
	import StatsRow from '$lib/components/StatsRow.svelte';
	import Text from '$lib/components/Text.svelte';
	import {
		getCycleDetails,
		getCycleSegments,
		getPredictionAccuracy,
		toFertilityEntry
	} from '$lib/utils/fertility';

	type Tab = 'comparison' | 'luteal' | 'accuracy';

	let tab = $state<Tab>('comparison');

	const fertilityEntries = $derived(entriesStore.entries.map(toFertilityEntry));
	const cycleDetails = $derived(getCycleDetails(fertilityEntries));
	const withLuteal = $derived(cycleDetails.filter((c) => c.lutealPhaseLength !== undefined));
	const accuracyRecords = $derived(getPredictionAccuracy(fertilityEntries));
	const segments = $derived(getCycleSegments(fertilityEntries));
	const alignedSegments = $derived(
		segments.filter((s) => s.ovulationDay != null && s.entries.some((e) => e.bbt !== undefined))
	);

	const lutealStats = $derived.by(() => {
		if (withLuteal.length < 2) return null;
		const lengths = withLuteal.map((c) => c.lutealPhaseLength as number);
		const avg = Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length);
		const last = lengths[lengths.length - 1];
		const lastTwo = lengths.slice(-2);
		const isConcerning = lastTwo.length === 2 && lastTwo.every((l) => l < 10);
		const isTrending =
			lengths.length >= 3 &&
			lengths[lengths.length - 1] < lengths[lengths.length - 2] &&
			lengths[lengths.length - 2] < lengths[lengths.length - 3];
		return { avg, last, count: withLuteal.length, isConcerning, isTrending };
	});

	const accuracyStats = $derived.by(() => {
		if (accuracyRecords.length === 0) return null;
		const absErrors = accuracyRecords.map((r) => Math.abs(r.errorDays));
		const avgError = Math.round(absErrors.reduce((a, b) => a + b, 0) / absErrors.length);
		const maxError = Math.max(...absErrors);
		const accurate = absErrors.filter((e) => e <= 2).length;
		const accuracyPct = Math.round((accurate / accuracyRecords.length) * 100);
		return { avgError, maxError, accuracyPct };
	});
</script>

<svelte:head>
	<title>Analytics — Lavender</title>
</svelte:head>

<Text as="h2">Analytics</Text>

{#if entriesStore.loading && entriesStore.entries.length === 0}
	<Text variant="muted">Loading your data…</Text>
{:else if entriesStore.entries.length === 0}
	<div class="empty">
		<Text as="h3">No Data Yet</Text>
		<p>Add health entries to see analytics and trends.</p>
	</div>
{:else}
	<div class="tab-bar">
		<Button variant="ghost" type="button" active={tab === 'comparison'} onclick={() => (tab = 'comparison')}>
			Cycle Comparison
		</Button>
		<Button variant="ghost" type="button" active={tab === 'luteal'} onclick={() => (tab = 'luteal')}>
			Luteal Trends
		</Button>
		<Button variant="ghost" type="button" active={tab === 'accuracy'} onclick={() => (tab = 'accuracy')}>
			Prediction Accuracy
		</Button>
	</div>

	{#if tab === 'luteal'}
		{#if lutealStats == null}
			<div class="empty">
				<Text as="h3">Not Enough Data</Text>
				<p>Luteal phase trends require at least 2 complete cycles with detected ovulation. Keep logging daily to unlock this view.</p>
			</div>
		{:else}
			{#if lutealStats.isConcerning}
				<div class="banner warning">
					Short luteal phase detected in last 2 cycles (&lt;10 days). Consider discussing with a healthcare provider.
				</div>
			{:else if lutealStats.isTrending}
				<div class="banner info">
					Luteal phase length has been decreasing over the last 3 cycles.
				</div>
			{/if}
			<StatsRow>
				<StatCard value={lutealStats.avg} label="Avg Luteal Phase (days)" />
				<StatCard value={lutealStats.last} label="Last Cycle (days)" warning={lutealStats.last < 10} />
				<StatCard value={lutealStats.count} label="Cycles Analyzed" />
			</StatsRow>
			<LutealChart cycles={withLuteal} />
		{/if}
	{:else if tab === 'accuracy'}
		{#if accuracyStats == null}
			<div class="empty">
				<Text as="h3">Not Enough Data</Text>
				<p>Prediction accuracy requires at least 3 recorded period start dates.</p>
			</div>
		{:else}
			<StatsRow>
				<StatCard value="{accuracyStats.accuracyPct}%" label="Within ±2 Days" />
				<StatCard value={accuracyStats.avgError} label="Avg Error (days)" />
				<StatCard value={accuracyStats.maxError} label="Max Error (days)" />
			</StatsRow>
			<AccuracyChart records={accuracyRecords} />
		{/if}
	{:else if alignedSegments.length < 2}
		<div class="empty">
			<Text as="h3">Not Enough Data</Text>
			<p>Cycle comparison requires at least 2 cycles with both BBT readings and detected ovulation.</p>
		</div>
	{:else}
		<StatsRow>
			<StatCard value={alignedSegments.length} label="Cycles Available" />
		</StatsRow>
		<ComparisonChart segments={alignedSegments} />
	{/if}
{/if}

<style>
	.tab-bar {
		display: flex;
		gap: var(--space-xs);
		margin-bottom: var(--space-md);
		border-bottom: 1px solid var(--color-border);
	}

	.tab-bar :global(.btn) {
		border-radius: 0;
		border-bottom: 2px solid transparent;
		color: var(--color-text-muted);
		font-size: var(--text-sm);
	}

	.tab-bar :global(.btn.active) {
		color: var(--color-primary);
		border-bottom-color: var(--color-primary);
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

	.banner {
		padding: var(--space-md);
		border-radius: var(--radius-md);
		margin-bottom: var(--space-md);
		font-size: var(--text-sm);
	}

	.banner.warning {
		background: var(--color-warning-bg);
		color: var(--color-warning);
		border: 1px solid var(--color-warning);
	}

	.banner.info {
		background: var(--color-primary-alpha);
		color: var(--color-primary);
	}
</style>
