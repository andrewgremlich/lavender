<script lang="ts">
	import "@fontsource/merriweather-sans"; // Defaults to weight 400
	import "@fontsource/merriweather-sans/400.css"; // Specify weight
	import "@fontsource/merriweather-sans/400-italic.css"; // Specify weight and style

	import '../app.css';
	import '../reset.css';
	import { setupI18n } from '$lib/i18n';

	setupI18n();

	let { children } = $props();
</script>

{@render children()}
