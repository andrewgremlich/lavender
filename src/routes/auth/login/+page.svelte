<script lang="ts">
	import { goto } from '$app/navigation';
	import { auth } from '$lib/client/auth.svelte';
	import Button from '$lib/components/Button.svelte';
	import Input from '$lib/components/Input.svelte';
	import Text from '$lib/components/Text.svelte';

	let username = $state('');
	let password = $state('');
	let error = $state<string | null>(null);
	let submitting = $state(false);

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		error = null;
		submitting = true;
		try {
			const hasRecovery = await auth.login(username, password);
			if (!hasRecovery) {
				// Existing user without a recovery code — route through recovery setup.
				await goto('/auth/recovery?setup=1');
			} else {
				await goto('/app');
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Sign-in failed';
		} finally {
			submitting = false;
		}
	}
</script>

<svelte:head>
	<title>Sign in — Lavender</title>
</svelte:head>

<main>
	<Text as="h1">Sign in</Text>
	<form onsubmit={handleSubmit}>
		<Input
			label="Username"
			type="text"
			autocomplete="username"
			bind:value={username}
			required
			disabled={submitting}
		/>
		<Input
			label="Password"
			type="password"
			autocomplete="current-password"
			bind:value={password}
			required
			disabled={submitting}
		/>
		{#if error}
			<Text variant="error" role="alert">{error}</Text>
		{/if}
		<Button type="submit" disabled={submitting}>
			{submitting ? 'Signing in…' : 'Sign in'}
		</Button>
	</form>
	<Text class="links">
		<a href="/auth/register">Create an account</a>
		<span aria-hidden="true">·</span>
		<a href="/auth/recovery">Forgot password?</a>
	</Text>
</main>

<style>
	main {
		max-width: 24rem;
		margin: 4rem auto;
		padding: 2rem;
	}
	form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	:global(.links) {
		margin-top: 1.5rem;
		font-size: 0.875rem;
		text-align: center;
	}
	:global(.links) a {
		color: #7c5cff;
	}
</style>
