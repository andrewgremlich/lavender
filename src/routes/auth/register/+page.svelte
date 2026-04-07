<script lang="ts">
	import { goto } from '$app/navigation';
	import { auth } from '$lib/client/auth.svelte';

	let username = $state('');
	let password = $state('');
	let confirm = $state('');
	let error = $state<string | null>(null);
	let submitting = $state(false);
	let recoveryCode = $state<string | null>(null);
	let acknowledged = $state(false);

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		error = null;
		if (password !== confirm) {
			error = 'Passwords do not match';
			return;
		}
		submitting = true;
		try {
			recoveryCode = await auth.register(username, password);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Registration failed';
		} finally {
			submitting = false;
		}
	}

	async function handleContinue() {
		await goto('/app');
	}
</script>

<svelte:head>
	<title>Create account — Lavender</title>
</svelte:head>

<main>
	{#if recoveryCode}
		<h1>Save your recovery code</h1>
		<p>
			This code is the <strong>only way</strong> to recover your data if you forget your password. Store
			it somewhere safe — we cannot show it to you again.
		</p>
		<pre class="code">{recoveryCode}</pre>
		<label class="checkbox">
			<input type="checkbox" bind:checked={acknowledged} />
			I have saved my recovery code in a safe place.
		</label>
		<button type="button" disabled={!acknowledged} onclick={handleContinue}>
			Continue to app
		</button>
	{:else}
		<h1>Create account</h1>
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
					autocomplete="new-password"
					bind:value={password}
					required
					disabled={submitting}
				/>
			</label>
			<label>
				Confirm password
				<input
					type="password"
					autocomplete="new-password"
					bind:value={confirm}
					required
					disabled={submitting}
				/>
			</label>
			{#if error}
				<p class="error" role="alert">{error}</p>
			{/if}
			<button type="submit" disabled={submitting}>
				{submitting ? 'Creating account…' : 'Create account'}
			</button>
		</form>
		<p class="links">
			<a href="/auth/login">Already have an account?</a>
		</p>
	{/if}
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
	label.checkbox {
		flex-direction: row;
		align-items: center;
		gap: 0.5rem;
		margin: 1.25rem 0;
	}
	input[type='text'],
	input[type='password'] {
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
	.code {
		font-family: ui-monospace, 'SF Mono', Menlo, monospace;
		font-size: 1.1rem;
		padding: 1rem;
		background: #f5f3ff;
		border: 1px solid #ddd;
		border-radius: 0.35rem;
		text-align: center;
		letter-spacing: 0.05em;
		user-select: all;
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
