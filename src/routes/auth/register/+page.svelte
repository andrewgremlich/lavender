<script lang="ts">
	import { goto } from '$app/navigation';
	import { auth } from '$lib/client/auth.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Input from '$lib/components/forms/Input.svelte';
	import Text from '$lib/components/ui/Text.svelte';
	import { _ } from 'svelte-i18n';

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
			error = $_('auth.register.passwordRequirementsNotMet');
			return;
		}
		if (password !== confirm) {
			error = $_('auth.register.passwordsMismatch');
			return;
		}
		submitting = true;
		try {
			recoveryCode = await auth.register(username, password);
		} catch (e) {
			error = e instanceof Error ? e.message : $_('auth.register.failed');
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
	<title>{$_('auth.register.pageTitle')}</title>
</svelte:head>

<main>
	{#if recoveryCode}
		<Text as="h1">{$_('auth.register.recoveryCode.title')}</Text>
		<p>
			This code is the <strong>{$_('auth.register.recoveryCode.onlyWay')}</strong> to recover your data
			if you forget your password. Store it somewhere safe — we cannot show it to you again.
		</p>
		<div class="code-wrapper">
			<pre class="code">{recoveryCode}</pre>
			<Button variant="outline" size="sm" type="button" onclick={copyCode}>
				{copied ? $_('auth.register.recoveryCode.copied') : $_('auth.register.recoveryCode.copy')}
			</Button>
		</div>
		<label class="checkbox">
			<input type="checkbox" bind:checked={acknowledged} />
			{$_('auth.register.recoveryCode.acknowledged')}
		</label>
		<Button type="button" disabled={!acknowledged} onclick={handleContinue}>
			{$_('auth.register.recoveryCode.continue')}
		</Button>
	{:else}
		<Text as="h1">{$_('auth.register.title')}</Text>
		<form onsubmit={handleSubmit}>
			<Input
				label={$_('auth.register.username')}
				type="text"
				autocomplete="username"
				bind:value={username}
				required
				disabled={submitting}
			/>
			<Input
				label={$_('auth.register.password')}
				type="password"
				autocomplete="new-password"
				bind:value={password}
				required
				disabled={submitting}
			/>
			<ul class="requirements">
				<li class:met={reqs.length}>{$_('auth.register.requirements.length')}</li>
				<li class:met={reqs.number}>{$_('auth.register.requirements.number')}</li>
				<li class:met={reqs.special}>{$_('auth.register.requirements.special')}</li>
			</ul>
			<Input
				label={$_('auth.register.confirmPassword')}
				type="password"
				autocomplete="new-password"
				bind:value={confirm}
				required
				disabled={submitting}
			/>
			{#if error}
				<Text variant="error" role="alert">{error}</Text>
			{/if}
			<Button type="submit" disabled={submitting}>
				{submitting ? $_('auth.register.submitting') : $_('auth.register.submit')}
			</Button>
		</form>
		<Text class="links">
			<a href="/auth/login">{$_('auth.register.alreadyHaveAccount')}</a>
		</Text>
	{/if}
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
	label.checkbox {
		display: flex;
		flex-direction: row;
		align-items: center;
		font-size: 0.875rem;
		gap: 0.5rem;
		margin: 1.25rem 0;
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
	:global(.links) {
		margin-top: 1.5rem;
		font-size: 0.875rem;
		text-align: center;
	}
	:global(.links) a {
		color: #7c5cff;
	}
</style>
