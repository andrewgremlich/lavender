<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		row?: boolean;
		children: Snippet;
	};

	let { row = false, children }: Props = $props();
</script>

<div class="pill-group" class:row>
	{@render children()}
</div>

<style>
	.pill-group {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-sm);
		margin-top: var(--space-sm);
	}

	.pill-group.row {
		flex-direction: row;
	}
</style>
