<script lang="ts">
	import Chart, { type TooltipItem } from 'chart.js/auto';
	import { onDestroy } from 'svelte';
	import type { HealthEntry } from '$lib/client/entries.svelte';
	import type { FertilityIndicators } from '$lib/utils/fertility';
	import { countIndicators, getActiveIndicatorLabels, INDICATORS } from '$lib/utils/indicators';
	import { celsiusToFahrenheit, getUnitSystem } from '$lib/utils/units';

	type Props = {
		entries: HealthEntry[];
		fertility: FertilityIndicators;
	};

	let { entries, fertility }: Props = $props();

	const LH_LABELS: Record<number, string> = { 0: 'None', 1: 'Light', 2: 'Positive' };
	const MUCUS_LABELS: Record<string, string> = {
		dry: 'Dry',
		sticky: 'Sticky',
		creamy: 'Creamy',
		watery: 'Watery',
		eggWhite: 'Egg White'
	};

	function normalizeLhSurge(value: unknown): 0 | 1 | 2 {
		if (value === true) return 2;
		if (typeof value === 'number' && (value === 0 || value === 1 || value === 2)) return value;
		return 0;
	}

	let canvas: HTMLCanvasElement | undefined = $state();
	let chart: Chart | null = null;

	function buildChart() {
		if (!canvas) return;
		chart?.destroy();

		const isUS = getUnitSystem() === 'us';
		const tempUnit = isUS ? '°F' : '°C';
		const bbtEntries = entries.filter((e) => e.basalBodyTemp != null);
		const labels = bbtEntries.map((e) => e.date);
		const temps = bbtEntries.map((e) =>
			isUS ? celsiusToFahrenheit(e.basalBodyTemp ?? 0) : (e.basalBodyTemp ?? 0)
		);

		const buffer = isUS ? 0.5 : 0.3;
		const tempMin =
			temps.length > 0 ? Math.floor((Math.min(...temps) - buffer) * 10) / 10 : isUS ? 96 : 35.5;
		const tempMax =
			temps.length > 0 ? Math.ceil((Math.max(...temps) + buffer) * 10) / 10 : isUS ? 100 : 37.5;

		const movingAvg = (i: number): number => {
			const start = Math.max(0, i - 1);
			const end = Math.min(temps.length - 1, i + 1);
			const slice = temps.slice(start, end + 1);
			return slice.reduce((a, b) => a + b, 0) / slice.length;
		};

		const { ovulationDays, fertileWindowDays } = fertility;
		const pointBorderColors = bbtEntries.map((e) => {
			if (ovulationDays.has(e.date)) return '#ec4899';
			if (normalizeLhSurge(e.lhSurge) >= 1) return '#f59e0b';
			return '#7c3aed';
		});
		const pointRadius = bbtEntries.map((e) =>
			ovulationDays.has(e.date) || normalizeLhSurge(e.lhSurge) >= 1 ? 6 : 3
		);
		const pointBgColors = bbtEntries.map((e) => {
			if (ovulationDays.has(e.date)) return '#ec4899';
			if (normalizeLhSurge(e.lhSurge) >= 1) return '#f59e0b';
			if (fertileWindowDays.has(e.date)) return 'rgba(16, 185, 129, 0.4)';
			return '#7c3aed';
		});

		const lhSurgeData = bbtEntries.map((e) => normalizeLhSurge(e.lhSurge));
		const indicatorCounts = bbtEntries.map((e) =>
			countIndicators(e as unknown as Record<string, unknown>)
		);
		const maxIndicators = INDICATORS.length;

		const textColor = getComputedStyle(canvas).getPropertyValue('--color-text').trim() || '#1e1b4b';
		const gridColor =
			getComputedStyle(canvas).getPropertyValue('--color-border').trim() || 'rgba(0,0,0,0.08)';

		chart = new Chart(canvas, {
			data: {
				labels,
				datasets: [
					{
						type: 'bar' as const,
						label: 'LH Surge',
						data: lhSurgeData,
						backgroundColor: 'rgba(245, 158, 11, 0.5)',
						borderColor: 'rgba(245, 158, 11, 0.8)',
						borderWidth: 1,
						yAxisID: 'yIndicators',
						order: 3
					},
					{
						type: 'bar' as const,
						label: 'Indicators',
						data: indicatorCounts,
						backgroundColor: 'rgba(244, 114, 182, 0.35)',
						borderColor: 'rgba(244, 114, 182, 0.6)',
						borderWidth: 1,
						yAxisID: 'yIndicators',
						order: 2
					},
					{
						type: 'line' as const,
						label: `Basal Body Temp (${tempUnit})`,
						data: temps,
						borderColor: '#7c3aed',
						backgroundColor: 'rgba(124, 58, 237, 0.1)',
						pointBackgroundColor: pointBgColors,
						pointBorderColor: pointBorderColors,
						pointRadius,
						pointHoverRadius: 7,
						tension: 0.3,
						fill: true,
						yAxisID: 'y',
						order: 1,
						segment: {
							borderColor: (ctx) => {
								const i = ctx.p0DataIndex;
								if (i + 1 >= temps.length) return '#7c3aed';
								return movingAvg(i + 1) > movingAvg(i) ? '#10b981' : '#7c3aed';
							}
						}
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				scales: {
					x: {
						ticks: {
							maxRotation: 45,
							maxTicksLimit: 15,
							font: { size: 11 },
							color: textColor,
							callback: (value: unknown, index: number) => {
								const label = labels[index];
								if (!label) return value as string;
								const [, month, day] = label.split('-');
								return `${month}/${day}`;
							}
						},
						grid: { display: false }
					},
					y: {
						position: 'left',
						title: {
							display: true,
							text: `Temperature (${tempUnit})`,
							font: { size: 12 },
							color: textColor
						},
						min: tempMin,
						max: tempMax,
						ticks: { font: { size: 11 }, color: textColor, maxTicksLimit: 8 },
						grid: { color: gridColor }
					},
					yIndicators: {
						position: 'right',
						title: { display: true, text: 'Indicators', font: { size: 12 }, color: textColor },
						min: 0,
						max: maxIndicators + 1,
						ticks: { stepSize: 1, font: { size: 11 }, color: textColor },
						grid: { display: false }
					}
				},
				plugins: {
					tooltip: {
						callbacks: {
							label: (ctx: TooltipItem<'line'>) => {
								const decimals = isUS ? 1 : 2;
								return `${ctx.dataset.label}: ${(ctx.parsed.y as number).toFixed(decimals)}${tempUnit}`;
							},
							afterLabel: (ctx: TooltipItem<'line'>) => {
								const entry = bbtEntries[ctx.dataIndex];
								const lines: string[] = [];
								const lh = normalizeLhSurge(entry.lhSurge);
								if (lh > 0) lines.push(`LH Surge: ${LH_LABELS[lh]}`);
								if (entry.cervicalMucus) {
									lines.push(`Mucus: ${MUCUS_LABELS[entry.cervicalMucus] ?? entry.cervicalMucus}`);
								}
								const active = getActiveIndicatorLabels(
									entry as unknown as Record<string, unknown>
								);
								if (active.length > 0) lines.push(`Indicators: ${active.join(', ')}`);
								if (ovulationDays.has(entry.date)) lines.push('Ovulation Day');
								if (fertileWindowDays.has(entry.date)) lines.push('Fertile Window');
								if (entry.notes) lines.push(`Notes: ${entry.notes}`);
								return lines;
							}
						}
					},
					legend: { display: false }
				}
			}
		});
	}

	$effect(() => {
		// Re-run whenever entries or fertility change.
		void entries;
		void fertility;
		buildChart();
	});

	onDestroy(() => {
		chart?.destroy();
		chart = null;
	});
</script>

<div class="chart-container">
	<canvas bind:this={canvas}></canvas>
</div>

<style>
	.chart-container {
		position: relative;
		width: 100%;
		height: 320px;
		padding: var(--space-md);
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-sm);
	}

	@media (min-width: 768px) {
		.chart-container {
			height: 360px;
		}
	}
	@media (min-width: 1024px) {
		.chart-container {
			height: 400px;
		}
	}
</style>
