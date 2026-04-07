<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { auth } from '$lib/client/auth.svelte';
	import Button from '$lib/components/Button.svelte';
	import Input from '$lib/components/Input.svelte';

	// Two modes:
	//  - ?setup=1 (post-login): user is already authenticated and just needs to
	//    generate a recovery code for a legacy account.
	//  - default: unauthenticated recover-with-code flow for a forgotten password.
	const isSetupMode = $derived($page.url.searchParams.get('setup') === '1');

	let username = $state('');
	let recoveryCode = $state('');
	let newPassword = $state('');
	let confirm = $state('');
	let error = $state<string | null>(null);
	let submitting = $state(false);
	let generatedCode = $state<string | null>(null);
	let acknowledged = $state(false);
	let copied = $state(false);

	async function handleRecover(event: SubmitEvent) {
		event.preventDefault();
		error = null;
		if (newPassword !== confirm) {
			error = 'Passwords do not match';
			return;
		}
		submitting = true;
		try {
			generatedCode = await auth.recover(username, recoveryCode, newPassword);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Recovery failed';
		} finally {
			submitting = false;
		}
	}

	async function handleSetup() {
		error = null;
		submitting = true;
		try {
			generatedCode = await auth.setupRecovery();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to generate recovery code';
		} finally {
			submitting = false;
		}
	}

	async function handleContinue() {
		await goto('/app');
	}

	async function copyCode() {
		if (!generatedCode) return;
		await navigator.clipboard.writeText(generatedCode);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}
</script>

<svelte:head>
	<title>Account recovery — Lavender</title>
</svelte:head>

<main>
	{#if generatedCode}
		<h1>Save your {isSetupMode ? 'recovery' : 'new recovery'} code</h1>
		<p>
			This code is the <strong>only way</strong> to recover your data if you forget your password. Store
			it somewhere safe — we cannot show it to you again.
		</p>
		<div class="code-wrapper">
			<pre class="code">{generatedCode}</pre>
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
	{:else if isSetupMode}
		<h1>Set up account recovery</h1>
		<p>
			Your account doesn't have a recovery code yet. Generate one now so you can restore access if
			you forget your password.
		</p>
		{#if error}
			<p class="error" role="alert">{error}</p>
		{/if}
		<Button type="button" disabled={submitting} onclick={handleSetup}>
			{submitting ? 'Generating…' : 'Generate recovery code'}
		</Button>
	{:else}
		<h1>Recover account</h1>
		<p>Enter your username, recovery code, and a new password.</p>
		<form onsubmit={handleRecover}>
			<Input
				label="Username"
				type="text"
				autocomplete="username"
				bind:value={username}
				required
				disabled={submitting}
			/>
			<Input
				label="Recovery code"
				type="text"
				autocomplete="off"
				spellcheck="false"
				placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX"
				bind:value={recoveryCode}
				required
				disabled={submitting}
			/>
			<Input
				label="New password"
				type="password"
				autocomplete="new-password"
				bind:value={newPassword}
				required
				disabled={submitting}
			/>
			<Input
				label="Confirm new password"
				type="password"
				autocomplete="new-password"
				bind:value={confirm}
				required
				disabled={submitting}
			/>
			{#if error}
				<p class="error" role="alert">{error}</p>
			{/if}
			<Button type="submit" disabled={submitting}>
				{submitting ? 'Recovering…' : 'Recover account'}
			</Button>
		</form>
		<p class="links">
			<a href="/auth/login">Back to sign in</a>
		</p>
	{/if}
</main>

<style>
	main {
		max-width: 26rem;
		margin: 4rem auto;
		padding: 2rem;
	}
	h1 {
		margin: 0 0 1rem;
	}
	p {
		margin: 0 0 1rem;
	}
	form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	label.checkbox {
		display: flex;
		flex-direction: row;
		align-items: center;
		font-size: 0.875rem;
		gap: 0.5rem;
		margin: 1.25rem 0;
	}
	.error {
		margin: 0;
		color: #b00020;
		font-size: 0.875rem;
	}
	.code {
		font-family: ui-monospace, 'SF Mono', Menlo, monospace;
		font-size: 1.05rem;
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
	.code-wrapper :global(.btn) {
		align-self: flex-end;
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
