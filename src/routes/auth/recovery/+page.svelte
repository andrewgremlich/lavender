<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { auth } from '$lib/client/auth.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Input from '$lib/components/forms/Input.svelte';
	import Text from '$lib/components/ui/Text.svelte';
	import { _ } from 'svelte-i18n';

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
			error = $_('auth.recovery.passwordsMismatch');
			return;
		}
		submitting = true;
		try {
			generatedCode = await auth.recover(username, recoveryCode, newPassword);
		} catch (e) {
			error = e instanceof Error ? e.message : $_('auth.recovery.failed');
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
			error = e instanceof Error ? e.message : $_('auth.recovery.setupFailed');
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
	<title>{$_('auth.recovery.pageTitle')}</title>
</svelte:head>

<main>
	{#if generatedCode}
		<Text as="h1"
			>{isSetupMode ? $_('auth.recovery.setupCodeTitle') : $_('auth.recovery.newCodeTitle')}</Text
		>
		<p>
			This code is the <strong>{$_('auth.recovery.onlyWay')}</strong> to recover your data if you forget
			your password. Store it somewhere safe — we cannot show it to you again.
		</p>
		<div class="code-wrapper">
			<pre class="code">{generatedCode}</pre>
			<Button variant="outline" size="sm" type="button" onclick={copyCode}>
				{copied ? $_('common.copied') : $_('common.copy')}
			</Button>
		</div>
		<label class="checkbox">
			<input type="checkbox" bind:checked={acknowledged} />
			{$_('common.acknowledged')}
		</label>
		<Button type="button" disabled={!acknowledged} onclick={handleContinue}>
			{$_('common.continue')}
		</Button>
	{:else if isSetupMode}
		<Text as="h1">{$_('auth.recovery.setupTitle')}</Text>
		<p>{$_('auth.recovery.setupDescription')}</p>
		{#if error}
			<Text variant="error" role="alert">{error}</Text>
		{/if}
		<Button type="button" disabled={submitting} onclick={handleSetup}>
			{submitting ? $_('auth.recovery.generating') : $_('auth.recovery.generateCode')}
		</Button>
	{:else}
		<Text as="h1">{$_('auth.recovery.recoverTitle')}</Text>
		<p>{$_('auth.recovery.recoverDescription')}</p>
		<form onsubmit={handleRecover}>
			<Input
				label={$_('auth.recovery.username')}
				type="text"
				autocomplete="username"
				bind:value={username}
				required
				disabled={submitting}
			/>
			<Input
				label={$_('auth.recovery.recoveryCode')}
				type="text"
				autocomplete="off"
				spellcheck="false"
				placeholder={$_('auth.recovery.recoveryCodePlaceholder')}
				bind:value={recoveryCode}
				required
				disabled={submitting}
			/>
			<Input
				label={$_('auth.recovery.newPassword')}
				type="password"
				autocomplete="new-password"
				bind:value={newPassword}
				required
				disabled={submitting}
			/>
			<Input
				label={$_('auth.recovery.confirmNewPassword')}
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
				{submitting ? $_('auth.recovery.recovering') : $_('auth.recovery.recover')}
			</Button>
		</form>
		<Text class="links">
			<a href="/auth/login">{$_('auth.recovery.backToSignIn')}</a>
		</Text>
	{/if}
</main>

<style>
	main {
		max-width: 26rem;
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
	:global(.links) {
		margin-top: 1.5rem;
		font-size: 0.875rem;
		text-align: center;
	}
	:global(.links) a {
		color: #7c5cff;
	}
</style>
