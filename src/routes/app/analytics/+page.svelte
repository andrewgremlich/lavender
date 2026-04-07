<script lang="ts">
	import Chart, { type TooltipItem } from 'chart.js/auto';
	import { onDestroy } from 'svelte';
	import { entriesStore } from '$lib/client/entries.svelte';
	import Button from '$lib/components/Button.svelte';
	import Text from '$lib/components/Text.svelte';
	import {
		getCycleDetails,
		getCycleSegments,
		getPredictionAccuracy,
		toFertilityEntry
	} from '$lib/utils/fertility';
	import { celsiusToFahrenheit, getUnitSystem } from '$lib/utils/units';

	type Tab = 'luteal' | 'accuracy' | 'comparison';

	const CYCLE_COLORS = ['#7c3aed', '#ec4899', '#10b981', '#f59e0b', '#3b82f6', '#ef4444'];

	let tab = $state<Tab>('comparison');
	let selectedIndices = $state<Set<number>>(new Set());

	let lutealCanvas: HTMLCanvasElement | undefined = $state();
	let accuracyCanvas: HTMLCanvasElement | undefined = $state();
	let comparisonCanvas: HTMLCanvasElement | undefined = $state();
	let charts: Chart[] = [];

	function destroyCharts() {
		for (const c of charts) c.destroy();
		charts = [];
	}

	onDestroy(destroyCharts);

	function chartColors(el: HTMLElement): { text: string; grid: string } {
		const cs = getComputedStyle(el);
		return {
			text: cs.getPropertyValue('--color-text').trim() || '#1e1b4b',
			grid: cs.getPropertyValue('--color-border').trim() || 'rgba(0,0,0,0.08)'
		};
	}

	const fertilityEntries = $derived(entriesStore.entries.map(toFertilityEntry));
	const cycleDetails = $derived(getCycleDetails(fertilityEntries));
	const withLuteal = $derived(cycleDetails.filter((c) => c.lutealPhaseLength !== undefined));
	const accuracyRecords = $derived(getPredictionAccuracy(fertilityEntries));
	const segments = $derived(getCycleSegments(fertilityEntries));
	const alignedSegments = $derived(
		segments.filter((s) => s.ovulationDay != null && s.entries.some((e) => e.bbt !== undefined))
	);
	const recentAligned = $derived(alignedSegments.slice(-5));

	function switchTab(next: Tab) {
		tab = next;
		selectedIndices = new Set();
		destroyCharts();
	}

	// --- Luteal chart ---
	$effect(() => {
		if (tab !== 'luteal' || !lutealCanvas) return;
		destroyCharts();
		if (withLuteal.length < 2) return;

		const lengths = withLuteal.map((c) => c.lutealPhaseLength as number);
		const labels = withLuteal.map((c) => c.periodStart);
		const refLine10 = Array(labels.length).fill(10);
		const refLine12 = Array(labels.length).fill(12);
		const { text, grid } = chartColors(lutealCanvas);

		const chart = new Chart(lutealCanvas, {
			data: {
				labels,
				datasets: [
					{
						type: 'line' as const,
						label: 'Luteal Phase (days)',
						data: lengths,
						borderColor: '#7c3aed',
						backgroundColor: 'rgba(124,58,237,0.1)',
						pointBackgroundColor: lengths.map((l) =>
							l < 10 ? '#ef4444' : l < 12 ? '#f59e0b' : '#7c3aed'
						),
						pointRadius: 6,
						tension: 0.3,
						fill: true
					},
					{
						type: 'line' as const,
						label: 'Short threshold (10 days)',
						data: refLine10,
						borderColor: 'rgba(239,68,68,0.7)',
						borderDash: [6, 3],
						pointRadius: 0,
						fill: false
					},
					{
						type: 'line' as const,
						label: 'Low-normal threshold (12 days)',
						data: refLine12,
						borderColor: 'rgba(245,158,11,0.7)',
						borderDash: [6, 3],
						pointRadius: 0,
						fill: false
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				scales: {
					x: {
						ticks: { maxRotation: 45, maxTicksLimit: 12, font: { size: 11 }, color: text },
						grid: { display: false }
					},
					y: {
						title: { display: true, text: 'Days', color: text },
						min: 0,
						max: 20,
						ticks: { stepSize: 2, font: { size: 11 }, color: text },
						grid: { color: grid }
					}
				},
				plugins: {
					legend: { display: false },
					tooltip: {
						callbacks: {
							label: (ctx: TooltipItem<'line'>) => {
								if (ctx.datasetIndex === 0) return `Luteal phase: ${ctx.parsed.y} days`;
								return ctx.dataset.label ?? '';
							}
						}
					}
				}
			}
		});
		charts.push(chart);
	});

	// --- Accuracy chart ---
	$effect(() => {
		if (tab !== 'accuracy' || !accuracyCanvas) return;
		destroyCharts();
		if (accuracyRecords.length === 0) return;

		const errors = accuracyRecords.map((r) => r.errorDays);
		const labels = accuracyRecords.map((r) => r.periodStart);
		const { text, grid } = chartColors(accuracyCanvas);

		const chart = new Chart(accuracyCanvas, {
			type: 'bar',
			data: {
				labels,
				datasets: [
					{
						label: 'Prediction Error (days)',
						data: errors,
						backgroundColor: errors.map((e) =>
							Math.abs(e) <= 2
								? 'rgba(16,185,129,0.7)'
								: Math.abs(e) <= 5
									? 'rgba(245,158,11,0.7)'
									: 'rgba(239,68,68,0.7)'
						),
						borderColor: errors.map((e) =>
							Math.abs(e) <= 2 ? '#10b981' : Math.abs(e) <= 5 ? '#f59e0b' : '#ef4444'
						),
						borderWidth: 1
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				scales: {
					x: {
						ticks: { maxRotation: 45, maxTicksLimit: 12, font: { size: 11 }, color: text },
						grid: { display: false }
					},
					y: {
						title: { display: true, text: 'Error (days)', color: text },
						ticks: { font: { size: 11 }, color: text },
						grid: { color: grid }
					}
				},
				plugins: {
					legend: { display: false },
					tooltip: {
						callbacks: {
							label: (ctx: TooltipItem<'bar'>) => {
								const val = ctx.parsed.y as number;
								const dir = val > 0 ? 'late' : val < 0 ? 'early' : 'exact';
								return `${Math.abs(val)} day(s) ${dir}`;
							}
						}
					}
				}
			}
		});
		charts.push(chart);
	});

	// --- Comparison chart ---
	$effect(() => {
		if (tab !== 'comparison' || !comparisonCanvas) return;
		destroyCharts();
		if (alignedSegments.length < 2) return;

		const isUS = getUnitSystem() === 'us';
		const tempUnit = isUS ? '°F' : '°C';

		const hasFilter = selectedIndices.size > 0;
		const visible = hasFilter
			? recentAligned.filter((s) => selectedIndices.has(s.index))
			: recentAligned;

		const MIN_OFFSET = -20;
		const MAX_OFFSET = 20;
		const offsetRange: number[] = [];
		for (let d = MIN_OFFSET; d <= MAX_OFFSET; d++) offsetRange.push(d);

		const datasets = visible.map((segment) => {
			const colorIdx = recentAligned.findIndex((s) => s.index === segment.index);
			const offsetMap = new Map<number, number>();
			for (const entry of segment.entries) {
				if (entry.bbt !== undefined) {
					const temp = isUS ? celsiusToFahrenheit(entry.bbt) : entry.bbt;
					offsetMap.set(entry.dayOffset, temp);
				}
			}
			return {
				label: `Cycle ${segment.index + 1} (${segment.periodStart})`,
				data: offsetRange.map((d) => offsetMap.get(d) ?? null),
				borderColor: CYCLE_COLORS[colorIdx % CYCLE_COLORS.length],
				backgroundColor: 'transparent',
				pointRadius: offsetRange.map((d) => (offsetMap.has(d) ? 3 : 0)),
				tension: 0.3,
				spanGaps: true
			};
		});

		const allTemps = datasets.flatMap((d) =>
			(d.data as (number | null)[]).filter((v): v is number => v !== null)
		);
		const buffer = isUS ? 0.5 : 0.3;
		const yMin =
			allTemps.length > 0
				? Math.floor((Math.min(...allTemps) - buffer) * 10) / 10
				: isUS
					? 96
					: 35.5;
		const yMax =
			allTemps.length > 0
				? Math.ceil((Math.max(...allTemps) + buffer) * 10) / 10
				: isUS
					? 100
					: 37.5;

		const { text, grid } = chartColors(comparisonCanvas);

		const chart = new Chart(comparisonCanvas, {
			type: 'line',
			data: {
				labels: offsetRange.map((d) => (d === 0 ? 'Ovulation' : d > 0 ? `+${d}` : String(d))),
				datasets
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				scales: {
					x: {
						ticks: { font: { size: 10 }, color: text, maxTicksLimit: 20 },
						grid: { color: grid }
					},
					y: {
						title: { display: true, text: `Temp (${tempUnit})`, color: text },
						min: yMin,
						max: yMax,
						ticks: { font: { size: 11 }, color: text, maxTicksLimit: 8 },
						grid: { color: grid }
					}
				},
				plugins: {
					legend: { display: false },
					tooltip: {
						callbacks: {
							label: (ctx: TooltipItem<'line'>) => {
								const val = ctx.parsed.y as number;
								return `${ctx.dataset.label}: ${val.toFixed(isUS ? 1 : 2)}${tempUnit}`;
							}
						}
					}
				}
			}
		});
		charts.push(chart);
	});

	function toggleCycle(index: number) {
		const next = new Set(selectedIndices);
		if (next.has(index)) next.delete(index);
		else next.add(index);
		selectedIndices = next;
	}

	function clearSelection() {
		selectedIndices = new Set();
	}

	// Derived stats
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
		<Button
			variant="ghost"
			type="button"
			active={tab === 'comparison'}
			onclick={() => switchTab('comparison')}
		>
			Cycle Comparison
		</Button>
		<Button variant="ghost" type="button" active={tab === 'luteal'} onclick={() => switchTab('luteal')}>
			Luteal Trends
		</Button>
		<Button variant="ghost" type="button" active={tab === 'accuracy'} onclick={() => switchTab('accuracy')}>
			Prediction Accuracy
		</Button>
	</div>

	{#if tab === 'luteal'}
		{#if lutealStats == null}
			<div class="card empty">
				<Text as="h3">Not Enough Data</Text>
				<p>
					Luteal phase trends require at least 2 complete cycles with detected ovulation. Keep
					logging daily to unlock this view.
				</p>
			</div>
		{:else}
			{#if lutealStats.isConcerning}
				<div class="banner warning">
					Short luteal phase detected in last 2 cycles (&lt;10 days). Consider discussing with a
					healthcare provider.
				</div>
			{:else if lutealStats.isTrending}
				<div class="banner info">
					Luteal phase length has been decreasing over the last 3 cycles.
				</div>
			{/if}
			<div class="stats-row">
				<div class="stat">
					<div class="value">{lutealStats.avg}</div>
					<div class="label">Avg Luteal Phase (days)</div>
				</div>
				<div class="stat">
					<div class="value" class:warning={lutealStats.last < 10}>{lutealStats.last}</div>
					<div class="label">Last Cycle (days)</div>
				</div>
				<div class="stat">
					<div class="value">{lutealStats.count}</div>
					<div class="label">Cycles Analyzed</div>
				</div>
			</div>
			<div class="chart-card">
				<canvas bind:this={lutealCanvas}></canvas>
			</div>
		{/if}
	{:else if tab === 'accuracy'}
		{#if accuracyStats == null}
			<div class="card empty">
				<Text as="h3">Not Enough Data</Text>
				<p>Prediction accuracy requires at least 3 recorded period start dates.</p>
			</div>
		{:else}
			<div class="stats-row">
				<div class="stat">
					<div class="value">{accuracyStats.accuracyPct}%</div>
					<div class="label">Within ±2 Days</div>
				</div>
				<div class="stat">
					<div class="value">{accuracyStats.avgError}</div>
					<div class="label">Avg Error (days)</div>
				</div>
				<div class="stat">
					<div class="value">{accuracyStats.maxError}</div>
					<div class="label">Max Error (days)</div>
				</div>
			</div>
			<div class="chart-card">
				<canvas bind:this={accuracyCanvas}></canvas>
				<p class="muted small">Positive = period came later than predicted. Negative = earlier.</p>
			</div>
		{/if}
	{:else if alignedSegments.length < 2}
		<div class="card empty">
			<Text as="h3">Not Enough Data</Text>
			<p>
				Cycle comparison requires at least 2 cycles with both BBT readings and detected ovulation.
			</p>
		</div>
	{:else}
		<div class="stats-row">
			<div class="stat">
				<div class="value">
					{selectedIndices.size > 0 ? selectedIndices.size : recentAligned.length}
				</div>
				<div class="label">Cycles Shown</div>
			</div>
			<div class="stat">
				<div class="value">{recentAligned.length}</div>
				<div class="label">Available</div>
			</div>
		</div>
		<Button
			variant="ghost"
			type="button"
			onclick={clearSelection}
			disabled={selectedIndices.size === 0}
		>
			Show all cycles
		</Button>
		<div class="chart-card tall">
			<canvas bind:this={comparisonCanvas}></canvas>
			<div class="cycle-legend">
				{#each recentAligned as segment, i (segment.index)}
					{@const color = CYCLE_COLORS[i % CYCLE_COLORS.length]}
					{@const isActive = selectedIndices.has(segment.index)}
					<Button
						variant="ghost"
						type="button"
						size="sm"
						active={isActive}
						class={selectedIndices.size > 0 && !isActive ? 'dimmed' : ''}
						onclick={() => toggleCycle(segment.index)}
						aria-pressed={isActive}
					>
						<span class="legend-dot" style="background:{color}"></span>
						Cycle {segment.index + 1} ({segment.periodStart})
					</Button>
				{/each}
			</div>
			<p class="muted small">
				Day 0 = ovulation day. Negative days = before ovulation. Click cycles in the legend to
				select one or more to compare.
			</p>
		</div>
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

	.stats-row {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
		gap: var(--space-md);
		margin-bottom: var(--space-md);
	}

	.stat {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		padding: var(--space-md);
		text-align: center;
	}

	.value {
		font-size: var(--text-2xl);
		font-weight: 700;
		color: var(--color-primary);
	}

	.value.warning {
		color: var(--color-warning);
	}

	.label {
		font-size: var(--text-xs);
		color: var(--color-text-muted);
		margin-top: var(--space-xs);
	}

	.chart-card {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		padding: var(--space-md);
		box-shadow: var(--shadow-sm);
		position: relative;
	}

	.chart-card canvas {
		height: 300px;
		max-height: 300px;
	}

	.chart-card.tall canvas {
		height: 400px;
		max-height: 400px;
	}

	.cycle-legend {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-sm);
		margin-top: var(--space-md);
	}

	.cycle-legend :global(.btn) {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-full);
	}

	.cycle-legend :global(.btn.active) {
		border-color: var(--color-primary);
		background: var(--color-primary-alpha);
	}

	:global(.btn.dimmed) {
		opacity: 0.4;
	}

	.legend-dot {
		display: inline-block;
		width: 10px;
		height: 10px;
		border-radius: 50%;
	}
</style>
