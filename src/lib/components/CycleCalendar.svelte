<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import Button from '$lib/components/Button.svelte';
	import type { FertilityIndicators } from '$lib/utils/fertility';

	type Props = {
		fertility: FertilityIndicators;
		view?: 'week' | 'month';
	};

	let { fertility, view = 'month' }: Props = $props();

	let current = $state(new Date());

	const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const todayStr = new Date().toISOString().split('T')[0];

	function getDayClasses(dateStr: string): string[] {
		const classes: string[] = [];
		if (dateStr === todayStr) classes.push('today');
		if (fertility.periodDays.has(dateStr)) classes.push('period');
		else if (fertility.ovulationDays.has(dateStr)) classes.push('ovulation');
		else if (fertility.fertileWindowDays.has(dateStr)) classes.push('fertile');
		else if (fertility.predictedPeriodDays.has(dateStr)) classes.push('predicted-period');
		else if (fertility.predictedOvulationDays.has(dateStr)) classes.push('predicted-ovulation');
		else if (fertility.predictedFertileDays.has(dateStr)) classes.push('predicted-fertile');
		return classes;
	}

	function getDayTooltip(dateStr: string): string {
		const labels: string[] = [];
		if (fertility.periodDays.has(dateStr)) labels.push('Period');
		else if (fertility.predictedPeriodDays.has(dateStr)) labels.push('Predicted Period');
		if (fertility.ovulationDays.has(dateStr)) labels.push('Ovulation');
		else if (fertility.predictedOvulationDays.has(dateStr)) labels.push('Predicted Ovulation');
		if (fertility.fertileWindowDays.has(dateStr)) labels.push('Fertile Window');
		else if (fertility.predictedFertileDays.has(dateStr)) labels.push('Predicted Fertile');
		return labels.join(', ');
	}

	type Cell = { day: number; dateStr: string; empty?: boolean };

	const cells = $derived.by((): Cell[] => {
		if (view === 'week') {
			const start = new Date(current);
			start.setDate(start.getDate() - start.getDay());
			const out: Cell[] = [];
			for (let i = 0; i < 7; i++) {
				const d = new Date(start);
				d.setDate(start.getDate() + i);
				out.push({ day: d.getDate(), dateStr: d.toISOString().split('T')[0] });
			}
			return out;
		}
		const year = current.getFullYear();
		const month = current.getMonth();
		const firstDay = new Date(year, month, 1).getDay();
		const daysInMonth = new Date(year, month + 1, 0).getDate();
		const out: Cell[] = [];
		for (let i = 0; i < firstDay; i++) out.push({ day: 0, dateStr: '', empty: true });
		for (let d = 1; d <= daysInMonth; d++) {
			const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
			out.push({ day: d, dateStr });
		}
		return out;
	});

	const headerText = $derived.by(() => {
		if (view === 'week') {
			const start = new Date(current);
			start.setDate(start.getDate() - start.getDay());
			const end = new Date(start);
			end.setDate(start.getDate() + 6);
			const fmt = (d: Date) => d.toLocaleString('default', { month: 'short', day: 'numeric' });
			return `${fmt(start)} – ${fmt(end)}, ${end.getFullYear()}`;
		}
		return current.toLocaleString('default', { month: 'long', year: 'numeric' });
	});

	function prev() {
		const d = new Date(current);
		if (view === 'week') d.setDate(d.getDate() - 7);
		else d.setMonth(d.getMonth() - 1);
		current = d;
	}

	function next() {
		const d = new Date(current);
		if (view === 'week') d.setDate(d.getDate() + 7);
		else d.setMonth(d.getMonth() + 1);
		current = d;
	}

	const variabilityNote = $derived(
		fertility.cycleVariability != null && fertility.cycleVariability > 2
			? ` (±${fertility.cycleVariability} days)`
			: ''
	);
</script>

<div class="card" class:week-view={view === 'week'}>
	<header class="header">
		<Button variant="ghost" type="button" onclick={prev} aria-label="Previous">←</Button>
		<h3>{headerText}</h3>
		<Button variant="ghost" type="button" onclick={next} aria-label="Next">→</Button>
	</header>

	<div class="grid" role="grid">
		{#each DAY_NAMES as name (name)}
			<div class="day-header">{name}</div>
		{/each}
		{#each cells as cell, i (i)}
			{#if cell.empty}
				<div class="day-cell empty"></div>
			{:else}
				{@const classes = getDayClasses(cell.dateStr)}
				{@const tooltip = getDayTooltip(cell.dateStr)}
				{@const isOvulation =
					fertility.ovulationDays.has(cell.dateStr) ||
					fertility.predictedOvulationDays.has(cell.dateStr)}
				<div class="day-cell {classes.join(' ')}" title={tooltip}>
					{#if isOvulation}
						<span class="ovulation-egg" aria-label="Ovulation">
							<Icon name="egg" size={40} strokeWidth={1.5} />
							<span class="egg-day">{cell.day}</span>
						</span>
					{:else}
						<span class="day-number">{cell.day}</span>
					{/if}
				</div>
			{/if}
		{/each}
	</div>

	<div class="legend">
		<div class="legend-item"><span class="swatch period"></span> Period</div>
		<div class="legend-item"><span class="swatch fertile"></span> Fertile</div>
		<div class="legend-item"><span class="swatch ovulation"></span> Ovulation</div>
		<div class="legend-item"><span class="swatch predicted"></span> Predicted</div>
	</div>

	{#if fertility.averageCycleLength}
		<div class="cycle-info">
			Average cycle: {fertility.averageCycleLength} days{variabilityNote}
		</div>
	{/if}
</div>

<style>
	.card {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		padding: var(--space-md);
		box-shadow: var(--shadow-sm);
	}

	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: var(--space-md);
	}

	.header h3 {
		font-size: var(--text-base);
		margin: 0;
	}

	.header :global(.btn) {
		color: var(--color-primary);
		font-size: var(--text-lg);
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 2px;
		overflow: hidden;
	}

	.day-header {
		text-align: center;
		font-size: var(--text-xs);
		font-weight: 600;
		color: var(--color-text-muted);
		padding: var(--space-xs) 0;
	}

	.day-cell {
		aspect-ratio: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-sm);
		font-size: var(--text-sm);
		background: transparent;
		gap: 1px;
		overflow: hidden;
		min-width: 0;
	}

	.day-cell.empty {
		visibility: hidden;
	}

	.day-cell.today {
		outline: 2px solid var(--color-primary);
	}

	.day-cell.period {
		background: var(--cal-period-bg, #fee2e2);
		color: var(--cal-period-text, #991b1b);
	}

	.day-cell.fertile {
		background: var(--cal-fertile-bg, #ecfdf5);
		color: var(--cal-fertile-text, #065f46);
	}

	.day-cell.ovulation {
		background: var(--cal-ovulation-bg, #ede9fe);
		color: var(--cal-ovulation-text, #5b21b6);
	}

	.day-cell.predicted-period,
	.day-cell.predicted-ovulation,
	.day-cell.predicted-fertile {
		background: repeating-linear-gradient(
			45deg,
			var(--cal-period-bg, #fee2e2),
			var(--cal-period-bg, #fee2e2) 3px,
			var(--cal-predicted-stripe, #fecaca) 3px,
			var(--cal-predicted-stripe, #fecaca) 6px
		);
		color: var(--cal-period-text, #991b1b);
		opacity: 0.7;
	}

	.day-number {
		font-weight: 500;
		line-height: 1;
	}

	.ovulation-egg {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
	}

	.ovulation-egg :global(svg) {
		width: 85%;
		height: 85%;
	}

	.egg-day {
		position: absolute;
		font-size: var(--text-xs);
		font-weight: 600;
		line-height: 1;
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-md);
		margin-top: var(--space-md);
		font-size: var(--text-xs);
		color: var(--color-text-muted);
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: var(--space-xs);
	}

	.swatch {
		display: inline-block;
		width: 12px;
		height: 12px;
		border-radius: 2px;
	}

	.swatch.period {
		background: var(--cal-period-bg, #fee2e2);
	}
	.swatch.fertile {
		background: var(--cal-fertile-bg, #ecfdf5);
	}
	.swatch.ovulation {
		background: var(--cal-ovulation-bg, #ede9fe);
	}
	.swatch.predicted {
		background: repeating-linear-gradient(
			45deg,
			var(--cal-period-bg, #fee2e2),
			var(--cal-period-bg, #fee2e2) 3px,
			var(--cal-predicted-stripe, #fecaca) 3px,
			var(--cal-predicted-stripe, #fecaca) 6px
		);
	}

	.cycle-info {
		margin-top: var(--space-sm);
		font-size: var(--text-xs);
		color: var(--color-text-muted);
		text-align: center;
	}
</style>
