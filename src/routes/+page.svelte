<script lang="ts">
	import { goto } from '$app/navigation';
	import { auth } from '$lib/client/auth.svelte';
	import Logo from '$lib/components/Logo.svelte';
	import Text from '$lib/components/Text.svelte';

	$effect(() => {
		if (auth.loggedIn) goto('/app', { replaceState: true });
	});

	let tryingDemo = $state(false);
	let demoError = $state<string | null>(null);

	async function handleDemoLogin() {
		tryingDemo = true;
		demoError = null;
		try {
			await auth.demoLogin();
			await goto('/app', { replaceState: true });
		} catch (e) {
			demoError = e instanceof Error ? e.message : 'Could not start demo';
		} finally {
			tryingDemo = false;
		}
	}
</script>

<svelte:head>
	<title>Lavender</title>
</svelte:head>

<main>
	<Logo size="xl" class="hero-logo" />
	<Text as="h1">Lavender</Text>
	<Text variant="muted">
		A gentle companion for your personal wellness journey. Track, reflect, and bloom at your own
		rhythm. <a href="/info">About Lavender</a>
	</Text>
	<div class="cta-group">
		<a href="/auth/login" class="cta">Sign in</a>
		<button class="cta-secondary" onclick={handleDemoLogin} disabled={tryingDemo}>
			{tryingDemo ? 'Starting…' : 'Try it out'}
		</button>
	</div>
	{#if demoError}
		<Text variant="error">{demoError}</Text>
	{/if}
</main>

<style>
	main {
		max-width: 40rem;
		margin: 4rem auto;
		padding: 0 1rem;
		font-family: system-ui, sans-serif;
		text-align: center;
	}
	:global(.hero-logo) {
		margin: 0 auto var(--space-lg);
	}
	a {
		color: #7a5cbf;
	}
	.cta-group {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-md);
		margin-top: var(--space-lg);
		flex-wrap: wrap;
	}
	.cta {
		display: inline-flex;
		align-items: center;
		justify-content: center;
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
	.cta-secondary {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.75rem 2rem;
		font-size: var(--text-lg);
		font-weight: 500;
		color: var(--color-primary);
		background: transparent;
		border: 2px solid var(--color-primary);
		border-radius: var(--radius-md);
		cursor: pointer;
		transition:
			background var(--transition-fast),
			color var(--transition-fast);
	}
	.cta-secondary:hover:not(:disabled) {
		background: var(--color-primary-alpha);
	}
	.cta-secondary:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
</style>
