<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import './Button.css';

	type Variant =
		| 'primary'
		| 'outline'
		| 'danger'
		| 'danger-outline'
		| 'ghost'
		| 'icon'
		| 'icon-danger';

	type Size = 'sm' | 'md' | 'lg';

	type Props = HTMLButtonAttributes & {
		variant?: Variant;
		size?: Size;
		active?: boolean;
		class?: string;
		children: Snippet;
	};

	let {
		variant = 'primary',
		size = 'md',
		active = false,
		class: className = '',
		children,
		...rest
	}: Props = $props();
</script>

<button class="btn btn-{variant} size-{size} {className}" class:active {...rest}>
	{@render children()}
</button>