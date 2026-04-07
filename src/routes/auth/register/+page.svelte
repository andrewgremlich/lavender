<script lang="ts">
	import { goto } from '$app/navigation';
	import { auth } from '$lib/client/auth.svelte';
	import Button from '$lib/components/Button.svelte';

	let username = $state('');
	let password = $state('');
	let confirm = $state('');
	let error = $state<string | null>(null);
	let submitting = $state(false);
	let recoveryCode = $state<string | null>(null);
	let acknowledged = $state(false);
	let copied = $state(false);

	const reqs = $derived({
		length: password.length >= 12,
		number: /\d/.test(password),
		special: /[^a-zA-Z0-9]/.test(password)
	});

	const allMet = $derived(reqs.length && reqs.number && reqs.special);

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		error = null;
		if (!allMet) {
			error = 'Password does not meet all requirements';
			return;
		}
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

	async function copyCode() {
		if (!recoveryCode) return;
		await navigator.clipboard.writeText(recoveryCode);
		copied = true;
		setTimeout(() => (copied = false), 2000);
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
		<div class="code-wrapper">
			<pre class="code">{recoveryCode}</pre>
			<Button variant="outline" size="sm" type="button" onclick={copyCode}>
				{copied ? '✓ Copied' : 'Copy'}
			</Button>
		</div>
		<label class="checkbox">
			<input type="checkbox" bind:checked={acknowledged} />
			I have saved my recovery code in a safe place.
		</label>
		<Button type="button" disabled={!acknowledged} onclick={handleContinue}>
			Continue to app
		</Button>
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
			<ul class="requirements">
				<li class:met={reqs.length}>At least 12 characters</li>
				<li class:met={reqs.number}>At least one number</li>
				<li class:met={reqs.special}>At least one special character</li>
			</ul>
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
			<Button type="submit" disabled={submitting}>
				{submitting ? 'Creating account…' : 'Create account'}
			</Button>
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
		color: #1e1b4b;
		background: #fff;
	}
	.error {
		margin: 0;
		color: #b00020;
		font-size: 0.875rem;
	}
	.requirements {
		font-size: 0.8125rem;
		color: var(--color-text-muted, #6b7280);
		padding-left: 1rem;
		list-style: disc;
		margin: -0.5rem 0 0;
	}
	.requirements li {
		transition: color 0.15s;
	}
	.requirements li.met {
		color: var(--color-success, #10b981);
	}
	.code {
		font-family: ui-monospace, 'SF Mono', Menlo, monospace;
		font-size: 1.1rem;
		padding: 1rem;
		background: var(--color-surface, #f5f3ff);
		border: 1px solid var(--color-border, #ddd);
		border-radius: 0.35rem;
		text-align: center;
		letter-spacing: 0.05em;
		user-select: all;
		color: var(--color-text, #1e1b4b);
		white-space: pre-wrap;
		word-break: break-all;
		margin: 0;
	}
	.code-wrapper {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
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
