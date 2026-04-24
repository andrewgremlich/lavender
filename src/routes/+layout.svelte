<script lang="ts">
	import '../reset.css';
	import "@fontsource/merriweather-sans"; // Defaults to weight 400
	import "@fontsource/merriweather-sans/400.css"; // Specify weight
	import '../app.css';

	import { setupI18n } from '$lib/i18n';
	import { waitLocale } from 'svelte-i18n';

	setupI18n();

	let { children } = $props();
</script>

{#await waitLocale() then}
	{@render children()}
{/await}
