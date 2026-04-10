<script lang="ts">
	import type { Snippet } from 'svelte';
	import Text from '$lib/components/ui/Text.svelte';

	type Props = {
		title: string;
		danger?: boolean;
		children: Snippet;
	};

	let { title, danger = false, children }: Props = $props();
</script>

<section class="card" class:danger>
	<Text as="h3">{title}</Text>
	{@render children()}
</section>

<style>
	.card {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		padding: var(--space-lg);
		box-shadow: var(--shadow-sm);
		margin-bottom: var(--space-lg);
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.card.danger {
		border-color: #fca5a5;
	}

	.card.danger :global(h3) {
		color: var(--color-error);
	}
</style>
