<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';
	import './Input.css';

	type Props = HTMLInputAttributes & {
		label: string;
		value?: string;
		class?: string;
	};

	let { label, value = $bindable(''), class: className = '', ...rest }: Props = $props();

	const id = $derived(rest.id ?? `input-${label.toLowerCase().replace(/\s+/g, '-')}`);
</script>

<div class="input-field {className}">
	<label for={id}>{label}</label>
	<input {id} bind:value {...rest} />
</div>
