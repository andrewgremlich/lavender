<script lang="ts">
	import type { Snippet } from 'svelte';
	import Text from './Text.svelte';
	import Icon from './Icon.svelte';
	import Button from './Button.svelte';

	type Props = {
		header: string;
		children: Snippet;
	};

	let { children, header }: Props = $props();
	let dialog: HTMLDialogElement;

	export function open() {
		dialog.showModal();
		requestAnimationFrame(() => dialog.classList.add('open'));
	}

	export async function close() {
		dialog.classList.remove('open');
		const animation = dialog.animate(
			[
				{ opacity: 1, transform: 'translateY(0)' },
				{ opacity: 0, transform: 'translateY(-10px)' }
			],
			{ duration: 200, easing: 'ease-out', fill: 'forwards' }
		);
		await animation.finished;
		dialog.close();
		animation.cancel();
	}

	function handleClick(event: MouseEvent) {
		const rect = dialog.getBoundingClientRect();
		const clickedBackdrop =
			event.clientX < rect.left ||
			event.clientX > rect.right ||
			event.clientY < rect.top ||
			event.clientY > rect.bottom;
		if (clickedBackdrop) close();
	}
</script>

<dialog bind:this={dialog} onclick={handleClick}>
	<header>
		<h2>{header}</h2>
    <Button variant="ghost" aria-label="Close dialog" onclick={close}>
      <Icon name="arrow-up-to-line" size={32} />
    </Button>
	</header>
	{@render children()}
</dialog>

<style>
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-md);
  }

	dialog {
		border: none;
		border-radius: var(--radius-lg);
		padding: var(--space-lg);
		box-shadow: var(--shadow-lg);
		background-color: var(--color-bg);
    min-width: 300px;

		animation-name: dialog-open;
		animation-duration: 0.2s;
		animation-timing-function: ease-out;
	}

	dialog::backdrop {
		background: rgba(0, 0, 0, 0.5);
		opacity: 0;
		transition: opacity 0.2s ease-out;
	}

	:global(dialog.open::backdrop) {
		opacity: 1;
	}

	@keyframes dialog-open {
		from {
			opacity: 0;
			transform: translateY(-10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
