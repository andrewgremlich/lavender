<script lang="ts">
	import { goto } from '$app/navigation';
	import { auth } from '$lib/client/auth.svelte';
	import { onMount } from 'svelte';

	onMount(() => {
		if (auth.loggedIn) goto('/app', { replaceState: true });
	});
</script>

<svelte:head>
	<title>Lavender</title>
</svelte:head>

<main>
	<h1>Lavender</h1>
	<p>
		A gentle companion for your personal wellness journey. Track, reflect, and bloom at your own
		rhythm.
	</p>
	<a href="/auth/login">Sign in</a>
</main>

<style>
	main {
		max-width: 40rem;
		margin: 4rem auto;
		padding: 0 1rem;
		font-family: system-ui, sans-serif;
	}
	h1 {
		font-size: 2.5rem;
		margin-bottom: 0.5rem;
	}
	p {
		color: #555;
		margin-bottom: 1.5rem;
	}
	a {
		color: #7a5cbf;
	}
</style>
