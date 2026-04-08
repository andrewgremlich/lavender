<script lang="ts">
	import { _ } from 'svelte-i18n';
	import Button from './Button.svelte';

	type Range = '7' | '30' | 'all';

	type Props = {
		value: Range;
		onselect: (range: Range) => void;
	};

	let { value, onselect }: Props = $props();

	const options = $derived([
		{ value: '7' as Range, label: $_('rangeSelector.week') },
		{ value: '30' as Range, label: $_('rangeSelector.30days') },
		{ value: 'all' as Range, label: $_('rangeSelector.all') }
	]);
</script>

<div class="range-selector">
	{#each options as opt (opt.value)}
		<Button
			variant="ghost"
			type="button"
			active={value === opt.value}
			onclick={() => onselect(opt.value)}
		>
			{opt.label}
		</Button>
	{/each}
</div>

<style>
	.range-selector {
		display: flex;
		gap: var(--space-xs);
		margin-bottom: var(--space-md);
	}

	.range-selector :global(.btn) {
		flex: 1;
	}

	.range-selector :global(.btn.active) {
		background: var(--color-primary);
		color: var(--color-text-inverse);
		border-color: var(--color-primary);
	}
</style>
