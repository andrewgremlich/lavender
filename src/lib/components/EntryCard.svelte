<script lang="ts">
	import { goto } from '$app/navigation';
	import { entriesStore, type HealthEntry } from '$lib/client/entries.svelte';
	import { countIndicators, INDICATORS } from '$lib/utils/indicators';
	import { celsiusToFahrenheit, getUnitSystem } from '$lib/utils/units';
	import Icon from './Icon.svelte';

	type Props = { entry: HealthEntry };
	let { entry }: Props = $props();

	let expanded = $state(false);
	let deleting = $state(false);

	const MUCUS_LABELS: Record<string, string> = {
		dry: 'Dry',
		sticky: 'Sticky',
		creamy: 'Creamy',
		watery: 'Watery',
		eggWhite: 'Egg White'
	};
	const FLOW_LABELS: Record<string, string> = { light: 'Light', medium: 'Medium', heavy: 'Heavy' };
	const LH_LABELS: Record<number, string> = { 1: 'Light', 2: 'Positive' };

	function formatTemp(c: number): string {
		const isUS = getUnitSystem() === 'us';
		const t = isUS ? celsiusToFahrenheit(c) : c;
		return `${t.toFixed(isUS ? 1 : 2)}°${isUS ? 'F' : 'C'}`;
	}

	const tags = $derived.by(() => {
		const out: Array<{ text: string; kind?: 'bleeding' | 'indicators' }> = [];
		if (entry.basalBodyTemp != null) out.push({ text: formatTemp(entry.basalBodyTemp) });
		if (entry.cervicalMucus) {
			out.push({ text: MUCUS_LABELS[entry.cervicalMucus] ?? entry.cervicalMucus });
		}
		if (entry.lhSurge != null && entry.lhSurge > 0) {
			out.push({ text: entry.lhSurge === 2 ? 'LH+' : 'LH Light' });
		}
		if (entry.bleedingStart || entry.bleedingFlow) {
			const flow = entry.bleedingFlow ? ` (${FLOW_LABELS[entry.bleedingFlow]})` : '';
			out.push({ text: `Period${flow}`, kind: 'bleeding' });
		}
		const indCount = countIndicators(entry as unknown as Record<string, unknown>);
		if (indCount > 0) {
			out.push({
				text: `${indCount} indicator${indCount > 1 ? 's' : ''}`,
				kind: 'indicators'
			});
		}
		return out;
	});

	function details(): Array<{ label: string; value: string; wrap?: boolean }> {
		const rows: Array<{ label: string; value: string; wrap?: boolean }> = [];
		if (entry.basalBodyTemp != null) {
			rows.push({ label: 'Basal Body Temp', value: formatTemp(entry.basalBodyTemp) });
		}
		if (entry.cervicalMucus) {
			rows.push({
				label: 'Cervical Mucus',
				value: MUCUS_LABELS[entry.cervicalMucus] ?? entry.cervicalMucus
			});
		}
		if (entry.lhSurge != null && entry.lhSurge > 0) {
			rows.push({ label: 'LH Surge', value: LH_LABELS[entry.lhSurge] ?? String(entry.lhSurge) });
		}
		for (const ind of INDICATORS) {
			if ((entry as unknown as Record<string, unknown>)[ind.key]) {
				rows.push({ label: ind.label, value: 'Yes' });
			}
		}
		if (entry.bleedingStart) rows.push({ label: 'Bleeding Started', value: 'Yes' });
		if (entry.bleedingEnd) rows.push({ label: 'Bleeding Ended', value: 'Yes' });
		if (entry.bleedingFlow) {
			rows.push({
				label: 'Flow Intensity',
				value: FLOW_LABELS[entry.bleedingFlow] ?? entry.bleedingFlow
			});
		}
		if (entry.notes) rows.push({ label: 'Notes', value: entry.notes, wrap: true });
		return rows;
	}

	async function onDelete(e: MouseEvent) {
		e.stopPropagation();
		if (deleting) return;
		deleting = true;
		try {
			await entriesStore.deleteEntry(entry.id);
		} catch {
			deleting = false;
		}
	}

	function onEdit(e: MouseEvent) {
		e.stopPropagation();
		sessionStorage.setItem('lavender_edit_entry', JSON.stringify(entry));
		goto('/app/entry');
	}
</script>

<article class="entry-card">
	<header
		class="entry-header"
		role="button"
		tabindex="0"
		onclick={() => (expanded = !expanded)}
		onkeydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				expanded = !expanded;
			}
		}}
	>
		<span class="chevron" class:expanded><Icon name="chevron-down" size={16} /></span>
		<span class="date">{entry.date}</span>
		<div class="tags">
			{#if tags.length === 0}
				<span class="empty">No details</span>
			{:else}
				{#each tags as tag (tag.text)}
					<span
						class="tag"
						class:bleeding={tag.kind === 'bleeding'}
						class:indicators={tag.kind === 'indicators'}>{tag.text}</span
					>
				{/each}
			{/if}
		</div>
		<button class="icon-btn" title="Edit entry" onclick={onEdit} aria-label="Edit">
			<Icon name="pencil" size={16} />
		</button>
		<button
			class="icon-btn danger"
			title="Delete entry"
			onclick={onDelete}
			disabled={deleting}
			aria-label="Delete"
		>
			<Icon name="trash-2" size={16} />
		</button>
	</header>
	{#if expanded}
		<div class="details">
			{#each details() as row (row.label)}
				<div class="row" class:wrap={row.wrap}>
					<span class="row-label">{row.label}</span>
					<span class="row-value">{row.value}</span>
				</div>
			{/each}
			{#if details().length === 0}
				<div class="row"><span class="empty">No details recorded</span></div>
			{/if}
		</div>
	{/if}
</article>

<style>
	.entry-card {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-sm);
		margin-bottom: var(--space-sm);
		overflow: hidden;
	}

	.entry-header {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		padding: var(--space-md);
		cursor: pointer;
	}

	.chevron {
		display: inline-flex;
		transition: transform var(--transition-fast);
	}
	.chevron.expanded {
		transform: rotate(180deg);
	}

	.date {
		font-weight: 600;
		font-size: var(--text-sm);
		white-space: nowrap;
	}

	.tags {
		flex: 1;
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-xs);
		min-width: 0;
	}

	.tag {
		font-size: var(--text-xs);
		padding: 0.125rem 0.5rem;
		border-radius: var(--radius-full);
		background: var(--color-primary-alpha);
		color: var(--color-primary);
	}

	.tag.bleeding {
		background: var(--color-error-bg);
		color: var(--color-error);
	}

	.tag.indicators {
		background: var(--color-warning-bg);
		color: var(--color-warning);
	}

	.empty {
		opacity: 0.5;
		font-size: var(--text-xs);
	}

	.icon-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border: none;
		background: transparent;
		color: var(--color-text);
		border-radius: var(--radius-full);
		cursor: pointer;
		transition: background-color var(--transition-fast);
	}

	.icon-btn:hover:not(:disabled) {
		background: var(--color-primary-alpha);
		color: var(--color-primary);
	}

	.icon-btn.danger:hover:not(:disabled) {
		background: var(--color-error-bg);
		color: var(--color-error);
	}

	.icon-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.details {
		border-top: 1px solid var(--color-border);
		padding: var(--space-md);
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.row {
		display: flex;
		justify-content: space-between;
		gap: var(--space-md);
		font-size: var(--text-sm);
	}

	.row.wrap {
		flex-direction: column;
		gap: var(--space-xs);
	}

	.row-label {
		color: var(--color-text-muted);
	}

	.row-value {
		color: var(--color-text);
		overflow-wrap: anywhere;
	}
</style>
