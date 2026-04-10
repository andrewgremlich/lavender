<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		children: Snippet;
	};

	let { children }: Props = $props();
</script>

<label class="pill-option">
	{@render children()}
</label>

<style>
	.pill-option {
		position: relative;
		flex: 1 1 auto;
		min-width: 80px;
	}

	.pill-option :global(input[type='radio']),
	.pill-option :global(input[type='checkbox']) {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}

	.pill-option :global(span) {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-xs);
		padding: var(--space-sm) var(--space-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		font-size: var(--text-sm);
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.pill-option :global(input:checked + span) {
		border-color: var(--color-primary);
		background: var(--color-primary-alpha);
		color: var(--color-primary);
	}
</style>
