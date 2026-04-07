<script lang="ts">
	import { goto } from '$app/navigation';
	import { settingsApi } from '$lib/client/api';
	import { entriesStore } from '$lib/client/entries.svelte';
	import CycleCalendar from '$lib/components/CycleCalendar.svelte';
	import EntryCard from '$lib/components/EntryCard.svelte';
	import MetricChart from '$lib/components/MetricChart.svelte';

	type Range = '7' | '30' | 'all';

	let range = $state<Range>('30');

	// Restore the user's preferred range from settings.
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

<h2>Dashboard</h2>

{#if entriesStore.loading && entriesStore.entries.length === 0}
	<p class="loading">Loading your data…</p>
{:else if entriesStore.error}
	<div class="error">{entriesStore.error}</div>
{:else if entriesStore.entries.length === 0}
	<div class="empty">
		<h3>No Data Yet</h3>
		<p>Start tracking your health metrics to see trends and insights.</p>
		<button type="button" class="btn-primary" onclick={() => goto('/app/entry')}>
			Add Your First Entry
		</button>
	</div>
{:else}
	<div class="range-selector">
		<button type="button" class:active={range === '7'} onclick={() => selectRange('7')}>Week</button
		>
		<button type="button" class:active={range === '30'} onclick={() => selectRange('30')}
			>30 Days</button
		>
		<button type="button" class:active={range === 'all'} onclick={() => selectRange('all')}
			>All</button
		>
	</div>

	<MetricChart entries={filtered} fertility={entriesStore.fertility} />

	<div class="legend">
		<span><span class="dot" style="background:#7c3aed"></span> BBT</span>
		<span
			><span class="dot" style="background:rgba(245,158,11,0.6);border-radius:2px"></span> LH Surge</span
		>
		<span><span class="dot" style="background:#ec4899"></span> Ovulation</span>
		<span><span class="dot" style="background:rgba(16,185,129,0.4)"></span> Fertile Window</span>
		<span
			><span class="dot" style="background:rgba(244,114,182,0.5);border-radius:2px"></span> Indicators</span
		>
	</div>

	<section class="calendar-section">
		<CycleCalendar fertility={entriesStore.fertility} view={range === '7' ? 'week' : 'month'} />
	</section>

	<section class="entries">
		<h3>Recent Entries</h3>
		{#if recent.length === 0}
			<p class="empty-msg">No entries in this range.</p>
		{:else}
			{#each recent as entry (entry.id)}
				<EntryCard {entry} />
			{/each}
		{/if}
	</section>
{/if}

<style>
	h2 {
		margin-bottom: var(--space-md);
	}

	.loading,
	.empty-msg {
		color: var(--color-text-muted);
		font-size: var(--text-sm);
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

	.empty h3 {
		margin-bottom: var(--space-sm);
	}

	.empty p {
		color: var(--color-text-muted);
		margin-bottom: var(--space-md);
	}

	.btn-primary {
		background: var(--color-primary);
		color: var(--color-text-inverse);
		border: none;
		padding: 0.625rem 1.25rem;
		border-radius: var(--radius-md);
		cursor: pointer;
		font-weight: 500;
	}

	.btn-primary:hover {
		background: var(--color-primary-hover);
	}

	.range-selector {
		display: flex;
		gap: var(--space-xs);
		margin-bottom: var(--space-md);
	}

	.range-selector button {
		flex: 1;
		padding: var(--space-sm) var(--space-md);
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: var(--color-text);
		border-radius: var(--radius-md);
		cursor: pointer;
		font-weight: 500;
		transition: all var(--transition-fast);
	}

	.range-selector button.active {
		background: var(--color-primary);
		color: var(--color-text-inverse);
		border-color: var(--color-primary);
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-md);
		margin: var(--space-md) 0;
		font-size: var(--text-xs);
		color: var(--color-text-muted);
	}

	.legend span {
		display: flex;
		align-items: center;
		gap: var(--space-xs);
	}

	.dot {
		display: inline-block;
		width: 10px;
		height: 10px;
		border-radius: 50%;
	}

	.calendar-section {
		margin: var(--space-lg) 0;
	}

	.entries {
		margin-top: var(--space-lg);
	}

	.entries h3 {
		margin-bottom: var(--space-md);
	}
</style>
