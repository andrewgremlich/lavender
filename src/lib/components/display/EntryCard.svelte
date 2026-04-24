<script lang="ts">
	import { goto } from '$app/navigation';
	import { entriesStore, type HealthEntry } from '$lib/client/entries.svelte';
	import { countIndicators, INDICATORS } from '$lib/utils/indicators';
	import { celsiusToFahrenheit, getUnitSystem } from '$lib/utils/units';
	import { _ } from 'svelte-i18n';
	import Button from '$lib/components/ui/Button.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';

	type Props = { entry: HealthEntry };
	let { entry }: Props = $props();

	let expanded = $state(false);
	let deleting = $state(false);

	const MUCUS_LABELS = $derived<Record<string, string>>({
		dry: $_('options.mucus.dry'),
		sticky: $_('options.mucus.sticky'),
		creamy: $_('options.mucus.creamy'),
		watery: $_('options.mucus.watery'),
		eggWhite: $_('options.mucus.eggWhite')
	});
	const FLOW_LABELS = $derived<Record<string, string>>({
		light: $_('options.flow.light'),
		medium: $_('options.flow.medium'),
		heavy: $_('options.flow.heavy')
	});
	const INTIMACY_LABELS = $derived<Record<string, string>>({
		unprotected: $_('options.intimacy.unprotected'),
		protected: $_('options.intimacy.protected')
	});
	const LH_LABELS = $derived<Record<number, string>>({
		1: $_('entryCard.lh.light'),
		2: $_('entryCard.lh.positive')
	});

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
			out.push({
				text: entry.lhSurge === 2 ? $_('entryCard.lh.positive') : $_('entryCard.lh.light')
			});
		}
		if (entry.bleedingStart || entry.bleedingFlow) {
			const flow = entry.bleedingFlow ? ` (${FLOW_LABELS[entry.bleedingFlow]})` : '';
			out.push({ text: `${$_('entryCard.period')}${flow}`, kind: 'bleeding' });
		}
		if (entry.intimacy) {
			out.push({ text: INTIMACY_LABELS[entry.intimacy] ?? entry.intimacy });
		}
		const indCount = countIndicators(entry as unknown as Record<string, unknown>);
		if (indCount > 0) {
			out.push({
				text:
					indCount > 1
						? $_('entryCard.indicators_plural', { values: { count: indCount } })
						: $_('entryCard.indicators', { values: { count: indCount } }),
				kind: 'indicators'
			});
		}
		return out;
	});

	function details(): Array<{ label: string; value: string; wrap?: boolean }> {
		const rows: Array<{ label: string; value: string; wrap?: boolean }> = [];
		if (entry.basalBodyTemp != null) {
			rows.push({
				label: $_('entryCard.labels.basalBodyTemp'),
				value: formatTemp(entry.basalBodyTemp)
			});
		}
		if (entry.cervicalMucus) {
			rows.push({
				label: $_('entryCard.labels.cervicalMucus'),
				value: MUCUS_LABELS[entry.cervicalMucus] ?? entry.cervicalMucus
			});
		}
		if (entry.lhSurge != null && entry.lhSurge > 0) {
			rows.push({
				label: $_('entryCard.labels.lhSurge'),
				value: LH_LABELS[entry.lhSurge] ?? String(entry.lhSurge)
			});
		}
		for (const ind of INDICATORS) {
			if ((entry as unknown as Record<string, unknown>)[ind.key]) {
				rows.push({ label: $_(`indicators.${ind.key}`), value: 'Yes' });
			}
		}
		if (entry.intimacy) {
			rows.push({
				label: $_('entryCard.labels.intimacy'),
				value: INTIMACY_LABELS[entry.intimacy] ?? entry.intimacy
			});
		}
		if (entry.bleedingStart)
			rows.push({ label: $_('entryCard.labels.bleedingSarted'), value: 'Yes' });
		if (entry.bleedingEnd) rows.push({ label: $_('entryCard.labels.bleedingEnded'), value: 'Yes' });
		if (entry.bleedingFlow) {
			rows.push({
				label: $_('entryCard.labels.flowIntensity'),
				value: FLOW_LABELS[entry.bleedingFlow] ?? entry.bleedingFlow
			});
		}
		if (entry.notes)
			rows.push({ label: $_('entryCard.labels.notes'), value: entry.notes, wrap: true });
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
		sessionStorage.setItem('lavender_edit_entry', entry.id);
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
				<span class="empty">{$_('entryCard.noDetails')}</span>
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
		<Button
			variant="icon"
			title={$_('entryCard.editEntry')}
			onclick={onEdit}
			aria-label={$_('entryCard.editEntry')}
		>
			<Icon name="pencil" size={16} />
		</Button>
		<Button
			variant="icon-danger"
			title={$_('entryCard.deleteEntry')}
			onclick={onDelete}
			disabled={deleting}
			aria-label={$_('entryCard.deleteEntry')}
		>
			<Icon name="trash-2" size={16} />
		</Button>
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
				<div class="row"><span class="empty">{$_('entryCard.noDetailsRecorded')}</span></div>
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
