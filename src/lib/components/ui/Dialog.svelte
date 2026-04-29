<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';
	import Button from './Button.svelte';

	type Props = {
		header?: string;
		children: Snippet;
		footer?: Snippet;
		class?: string;
	};

	let { children, header, footer, class: className }: Props = $props();
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

	function handleCancel(event: Event) {
		event.preventDefault();
		close();
	}
</script>

<dialog
	bind:this={dialog}
	onclick={handleClick}
	oncancel={handleCancel}
	aria-labelledby={header ? 'dialog-title' : undefined}
	class={className}
>
	<header>
		{#if header}
			<h2 id="dialog-title">{header}</h2>
		{/if}
		<Button variant="ghost" aria-label="Close dialog" onclick={close}>
			<Icon name="x" size={20} />
		</Button>
	</header>
	{@render children()}
	{#if footer}
		<footer>{@render footer()}</footer>
	{/if}
</dialog>

<style>
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-md);
  }

	footer {
		margin-top: var(--space-md);
		display: flex;
		justify-content: flex-end;
		gap: var(--space-sm);
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
