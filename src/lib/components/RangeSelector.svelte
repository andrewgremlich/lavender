<script lang="ts">
	import Button from './Button.svelte';

	type Range = '7' | '30' | 'all';
	type RangeOption = { value: Range; label: string };

	type Props = {
		value: Range;
		onselect: (range: Range) => void;
	};

	let { value, onselect }: Props = $props();

	const options: RangeOption[] = [
		{ value: '7', label: 'Week' },
		{ value: '30', label: '30 Days' },
		{ value: 'all', label: 'All' }
	];
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
