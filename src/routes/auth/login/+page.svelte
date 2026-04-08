<script lang="ts">
	import { goto } from '$app/navigation';
	import { auth } from '$lib/client/auth.svelte';
	import Button from '$lib/components/Button.svelte';
	import Input from '$lib/components/Input.svelte';
	import Text from '$lib/components/Text.svelte';
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
