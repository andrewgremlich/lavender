<script lang="ts">
	import { goto } from '$app/navigation';
	import { auth } from '$lib/client/auth.svelte';

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
	<h1>Sign in</h1>
	<form onsubmit={handleSubmit}>
		<label>
			Username
			<input
				type="text"
				autocomplete="username"
				bind:value={username}
				required
				disabled={submitting}
			/>
		</label>
		<label>
			Password
			<input
				type="password"
				autocomplete="current-password"
				bind:value={password}
				required
				disabled={submitting}
			/>
		</label>
		{#if error}
			<p class="error" role="alert">{error}</p>
		{/if}
		<button type="submit" disabled={submitting}>
			{submitting ? 'Signing in…' : 'Sign in'}
		</button>
	</form>
	<p class="links">
		<a href="/auth/register">Create an account</a>
		<span aria-hidden="true">·</span>
		<a href="/auth/recovery">Forgot password?</a>
	</p>
</main>

<style>
	main {
		max-width: 24rem;
		margin: 4rem auto;
		padding: 2rem;
	}
	h1 {
		margin: 0 0 1.5rem;
	}
	form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	label {
		display: flex;
		flex-direction: column;
		font-size: 0.875rem;
		gap: 0.35rem;
	}
	input {
		font: inherit;
		padding: 0.5rem 0.75rem;
		border: 1px solid #ccc;
		border-radius: 0.35rem;
	}
	button {
		font: inherit;
		padding: 0.6rem 1rem;
		border-radius: 0.35rem;
		border: none;
		background: #7c5cff;
		color: #fff;
		cursor: pointer;
	}
	button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
	.error {
		margin: 0;
		color: #b00020;
		font-size: 0.875rem;
	}
	.links {
		margin-top: 1.5rem;
		font-size: 0.875rem;
		text-align: center;
	}
	.links a {
		color: #7c5cff;
	}
</style>
