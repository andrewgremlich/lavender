<script lang="ts">
	type Props = {
		message: { text: string; type: 'success' | 'error' } | null;
	};

	let { message }: Props = $props();
</script>

{#if message}
	<div class="msg {message.type}">{message.text}</div>
{/if}

<style>
	.msg {
		padding: var(--space-sm) var(--space-md);
		border-radius: var(--radius-md);
		font-size: var(--text-sm);
	}

	.msg.success {
		background: var(--color-success-bg);
		color: var(--color-success);
	}

	.msg.error {
		background: var(--color-error-bg);
		color: var(--color-error);
	}
</style>
