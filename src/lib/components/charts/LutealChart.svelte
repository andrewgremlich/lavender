<script lang="ts">
	import Chart, { type TooltipItem } from 'chart.js/auto';
	import { onDestroy } from 'svelte';
	import type { getCycleDetails } from '$lib/utils/fertility';

	type CycleDetail = ReturnType<typeof getCycleDetails>[number];

	type Props = {
		cycles: CycleDetail[];
	};

	let { cycles }: Props = $props();

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
		if (!canvas || cycles.length < 2) return;
		chart?.destroy();

		const lengths = cycles.map((c) => c.lutealPhaseLength as number);
		const labels = cycles.map((c) => c.periodStart);
		const { text, grid } = getColors(canvas);

		chart = new Chart(canvas, {
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
						data: Array(labels.length).fill(10),
						borderColor: 'rgba(239,68,68,0.7)',
						borderDash: [6, 3],
						pointRadius: 0,
						fill: false
					},
					{
						type: 'line' as const,
						label: 'Low-normal threshold (12 days)',
						data: Array(labels.length).fill(12),
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
	});

	onDestroy(() => chart?.destroy());
</script>

<div class="chart-card">
	<canvas bind:this={canvas}></canvas>
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
</style>
