<script lang="ts">
	type Props = {
		message: { text: string; type: 'success' | 'error' } | null;
	};

	let { message }: Props = $props();

	let dialog: HTMLDialogElement;
	let inner: HTMLSpanElement;

	$effect(() => {
		if (!dialog) return;
		if (message) {
			if (!dialog.open) dialog.show();
			if (inner) {
				inner.style.animation = 'none';
				void inner.offsetWidth;
				inner.style.animation = '';
			}
		} else {
			if (dialog.open) dialog.close();
		}
	});
</script>

<dialog bind:this={dialog} class="msg {message?.type ?? ''}">
	<span bind:this={inner} class="inner">{message?.text ?? ''}</span>
</dialog>

<style>
	dialog {
		z-index: 1000;
		position: fixed;
		top: var(--space-lg);
		left: 50%;
		translate: -50% 0;
		margin: 0;
		border: none;
		padding: var(--space-sm) var(--space-md);
		border-radius: var(--radius-md);
		font-size: var(--text-sm);
		background: transparent;
	}

	dialog.success {
		background: var(--color-success-bg);
		color: var(--color-success);
	}

	dialog.error {
		background: var(--color-error-bg);
		color: var(--color-error);
	}

	.inner {
		animation: fadeInOut 4s forwards;
		display: block;
	}

	@keyframes fadeInOut {
		0% { opacity: 0; }
		10% { opacity: 1; }
		90% { opacity: 1; }
		100% { opacity: 0; }
	}
</style>
