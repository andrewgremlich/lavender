<script lang="ts">
	import { goto } from '$app/navigation';
	import { auth } from '$lib/client/auth.svelte';
	import Text from '$lib/components/Text.svelte';

	$effect(() => {
		if (auth.loggedIn) goto('/app', { replaceState: true });
	});
</script>

<svelte:head>
	<title>Lavender</title>
</svelte:head>

<main>
	<Text as="h1">Lavender</Text>
	<Text variant="muted">
		A gentle companion for your personal wellness journey. Track, reflect, and bloom at your own
		rhythm.
	</Text>
	<a href="/auth/login">Sign in</a>
</main>

<style>
	main {
		max-width: 40rem;
		margin: 4rem auto;
		padding: 0 1rem;
		font-family: system-ui, sans-serif;
	}
	a {
		color: #7a5cbf;
	}
</style>
