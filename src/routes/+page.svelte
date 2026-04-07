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
		rhythm. <a href="/info">About Lavender</a>
	</Text>
	<a href="/auth/login" class="cta">Sign in</a>
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
	.cta {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		margin-top: var(--space-lg);
		padding: 0.75rem 2rem;
		font-size: var(--text-lg);
		font-weight: 500;
		color: var(--color-text-inverse);
		background: var(--color-primary);
		border-radius: var(--radius-md);
		transition: background var(--transition-fast);
		text-decoration: none;
	}
	.cta:hover {
		background: var(--color-primary-hover);
		color: var(--color-text-inverse);
	}
</style>
