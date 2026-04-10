<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = { children: Snippet };
	let { children }: Props = $props();
</script>

<div class="stats-row">
	{@render children()}
</div>

<style>
	.stats-row {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
		gap: var(--space-md);
		margin-bottom: var(--space-md);
	}
</style>
