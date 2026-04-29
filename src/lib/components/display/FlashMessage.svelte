<script lang="ts">
	type Props = {
		message: { text: string; type: 'success' | 'error' } | null;
	};

	let { message }: Props = $props();
</script>

<div class="msg {message?.type} {message ? 'visible' : 'hidden'}">
	{message?.text ?? 'Flash message'}
</div>

<style>
	.hidden {
		top: -10px;
		opacity: 0;
		pointer-events: none;
	}

	.visible {
		top: var(--space-lg);
		opacity: 1;
		pointer-events: auto;

		animation-name: fadeInOut;
		animation-duration: 4s;
		animation-fill-mode: forwards;
	}

	.msg {
		position: absolute;
		left: 50%;
		transform: translateX(-50%);

		padding: var(--space-sm) var(--space-md);
		margin: var(--space-md) 0;
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

	@keyframes fadeInOut {
		0% {
			opacity: 0;
		}
		10% {
			opacity: 1;
		}
		90% {
			opacity: 1;
		}
		100% {
			opacity: 0;
		}
	}
</style>
