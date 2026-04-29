<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import './Text.css'; // this makes the styles global so as to apply to all text elements

	type Element = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'span';
	type Variant = 'default' | 'muted' | 'error' | 'success' | 'small';

	type Props = HTMLAttributes<HTMLElement> & {
		as?: Element;
		variant?: Variant;
		class?: string;
		children: Snippet;
	};

	let {
		as: tag = 'p',
		variant = 'default',
		class: className = '',
		children,
		...rest
	}: Props = $props();
</script>

<svelte:element
	this={tag}
	class="text text-{tag} {variant !== 'default' ? `text-${variant}` : ''} {className}"
	{...rest}
>
	{@render children()}
</svelte:element>
