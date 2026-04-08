<script lang="ts">
	import Chart, { type TooltipItem } from 'chart.js/auto';
	import { onDestroy } from 'svelte';
	import type { getPredictionAccuracy } from '$lib/utils/fertility';

	type AccuracyRecord = ReturnType<typeof getPredictionAccuracy>[number];

	type Props = {
		records: AccuracyRecord[];
	};

	let { records }: Props = $props();

	let canvas: HTMLCanvasElement | undefined = $state();
	let chart: Chart | null = null;

	function getColors(el: HTMLElement) {
		const cs = getComputedStyle(el);
		return {
			text: cs.getPropertyValue('--color-text').trim() || '#1e1b4b',
			grid: cs.getPropertyValue('--color-border').trim() || 'rgba(0,0,0,0.08)'
		};
	}

	$effect(() => {
		if (!canvas || records.length === 0) return;
		chart?.destroy();

		const errors = records.map((r) => r.errorDays);
		const labels = records.map((r) => r.periodStart);
		const { text, grid } = getColors(canvas);

		chart = new Chart(canvas, {
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
	});

	onDestroy(() => chart?.destroy());
</script>

<div class="chart-card">
	<canvas bind:this={canvas}></canvas>
	<p class="hint">Positive = period came later than predicted. Negative = earlier.</p>
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
		height: 300px;
		max-height: 300px;
	}

	.hint {
		font-size: var(--text-xs);
		color: var(--color-text-muted);
		margin-top: var(--space-sm);
	}
</style>
