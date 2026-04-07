<script lang="ts">
	import Chart, { type TooltipItem } from 'chart.js/auto';
	import { onDestroy } from 'svelte';
	import Button from './Button.svelte';
	import { celsiusToFahrenheit, getUnitSystem } from '$lib/utils/units';
	import type { getCycleSegments } from '$lib/utils/fertility';

	type Segment = ReturnType<typeof getCycleSegments>[number];

	const CYCLE_COLORS = ['#7c3aed', '#ec4899', '#10b981', '#f59e0b', '#3b82f6', '#ef4444'];
	const MIN_OFFSET = -20;
	const MAX_OFFSET = 20;
	const offsetRange: number[] = [];
	for (let d = MIN_OFFSET; d <= MAX_OFFSET; d++) offsetRange.push(d);

	type Props = {
		segments: Segment[];
	};

	let { segments }: Props = $props();

	let canvas: HTMLCanvasElement | undefined = $state();
	let chart: Chart | null = null;
	let selectedIndices = $state<Set<number>>(new Set());

	const recentAligned = $derived(segments.slice(-5));

	function getColors(el: HTMLElement) {
		const cs = getComputedStyle(el);
		return {
			text: cs.getPropertyValue('--color-text').trim() || '#1e1b4b',
			grid: cs.getPropertyValue('--color-border').trim() || 'rgba(0,0,0,0.08)'
		};
	}

	$effect(() => {
		if (!canvas || recentAligned.length < 2) return;
		chart?.destroy();

		const isUS = getUnitSystem() === 'us';
		const tempUnit = isUS ? '°F' : '°C';
		const hasFilter = selectedIndices.size > 0;
		const visible = hasFilter
			? recentAligned.filter((s) => selectedIndices.has(s.index))
			: recentAligned;

		const datasets = visible.map((segment) => {
			const colorIdx = recentAligned.findIndex((s) => s.index === segment.index);
			const offsetMap = new Map<number, number>();
			for (const entry of segment.entries) {
				if (entry.bbt !== undefined) {
					offsetMap.set(entry.dayOffset, isUS ? celsiusToFahrenheit(entry.bbt) : entry.bbt);
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
		const yMin = allTemps.length > 0
			? Math.floor((Math.min(...allTemps) - buffer) * 10) / 10
			: isUS ? 96 : 35.5;
		const yMax = allTemps.length > 0
			? Math.ceil((Math.max(...allTemps) + buffer) * 10) / 10
			: isUS ? 100 : 37.5;

		const { text, grid } = getColors(canvas);

		chart = new Chart(canvas, {
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

	onDestroy(() => chart?.destroy());
</script>

<div class="chart-card">
	<canvas bind:this={canvas}></canvas>
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
	<Button
		variant="ghost"
		type="button"
		onclick={clearSelection}
		disabled={selectedIndices.size === 0}
	>
		Show all cycles
	</Button>
	<p class="hint">
		Day 0 = ovulation day. Negative days = before ovulation. Click cycles in the legend to compare.
	</p>
</div>

<style>
	.chart-card {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		padding: var(--space-md);
		box-shadow: var(--shadow-sm);
	}

	.chart-card canvas {
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

	.hint {
		font-size: var(--text-xs);
		color: var(--color-text-muted);
		margin-top: var(--space-sm);
	}
</style>
