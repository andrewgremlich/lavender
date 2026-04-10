<script lang="ts">
	import { goto } from '$app/navigation';
	import { auth } from '$lib/client/auth.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Input from '$lib/components/forms/Input.svelte';
	import Logo from '$lib/components/layout/Logo.svelte';
	import Text from '$lib/components/ui/Text.svelte';
	import { _ } from 'svelte-i18n';

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
				await goto('/auth/recovery?setup=1');
			} else {
				await goto('/app');
			}
		} catch (e) {
			error = e instanceof Error ? e.message : $_('auth.login.failed');
		} finally {
			submitting = false;
		}
	}
</script>

<svelte:head>
	<title>{$_('auth.login.pageTitle')}</title>
</svelte:head>

<main>
	<Logo size="lg" class="auth-logo" />
	<Text as="h1">{$_('auth.login.title')}</Text>
	<form onsubmit={handleSubmit}>
		<Input
			label={$_('auth.login.username')}
			type="text"
			autocomplete="username"
			bind:value={username}
			required
			disabled={submitting}
		/>
		<Input
			label={$_('auth.login.password')}
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
			{submitting ? $_('auth.login.submitting') : $_('auth.login.submit')}
		</Button>
	</form>
	<Text class="links">
		<a href="/auth/register">{$_('auth.login.createAccount')}</a>
		<span aria-hidden="true">·</span>
		<a href="/auth/recovery">{$_('auth.login.forgotPassword')}</a>
	</Text>
</main>

<style>
	main {
		max-width: 24rem;
		margin: 4rem auto;
		padding: 2rem;
		text-align: center;
	}
	:global(.auth-logo) {
		margin: 0 auto var(--space-md);
	}
	form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		text-align: left;
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
