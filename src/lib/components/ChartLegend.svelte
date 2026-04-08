<script lang="ts">
	type LegendItem = {
		color: string;
		label: string;
		shape?: 'circle' | 'square';
	};

	type Props = {
		items: LegendItem[];
	};

	let { items }: Props = $props();
</script>

<div class="legend">
	{#each items as item (item.label)}
		<span>
			<span class="dot" class:square={item.shape === 'square'} style="background:{item.color}"
			></span>
			{item.label}
		</span>
	{/each}
</div>

<style>
	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-md);
		margin: var(--space-md) 0;
		font-size: var(--text-xs);
		color: var(--color-text-muted);
	}

	.legend span {
		display: flex;
		align-items: center;
		gap: var(--space-xs);
	}

	.dot {
		display: inline-block;
		width: 10px;
		height: 10px;
		border-radius: 50%;
	}

	.dot.square {
		border-radius: 2px;
	}
</style>
