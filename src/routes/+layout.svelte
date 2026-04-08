<script lang="ts">
	import '../app.css';
	import '../reset.css';
	import { setupI18n } from '$lib/i18n';

	setupI18n();

	let { children } = $props();
</script>

{@render children()}
