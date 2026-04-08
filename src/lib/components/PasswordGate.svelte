<script lang="ts">
	import { authApi, setToken } from '$lib/client/api';
	import { auth } from '$lib/client/auth.svelte';
	import {
		deriveKeyFromPassword,
		deriveLegacyKey,
		storeKey,
		storeLegacyKey
	} from '$lib/client/crypto';
	import Button from './Button.svelte';
	import Input from './Input.svelte';
	import Text from './Text.svelte';
	import type { Snippet } from 'svelte';

	type Props = { children: Snippet };
	let { children }: Props = $props();

	const VERIFY_KEY = 'lavender_last_verified';
	const VERIFY_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

	let password = $state('');
	let error = $state<string | null>(null);
	let submitting = $state(false);

	function needsVerification(): boolean {
		if (typeof localStorage === 'undefined') return false;
		const last = localStorage.getItem(VERIFY_KEY);
		if (!last) return true;
		return Date.now() - Number(last) > VERIFY_INTERVAL_MS;
	}

	let gated = $state(needsVerification());

	export function markVerified() {
		localStorage.setItem(VERIFY_KEY, String(Date.now()));
		gated = false;
	}

	// Fresh login/register already proved identity — mark as verified.
	$effect(() => {
		if (!gated) return;
		const last = localStorage.getItem(VERIFY_KEY);
		if (last && Date.now() - Number(last) <= VERIFY_INTERVAL_MS) {
			gated = false;
		}
	});

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		error = null;
		submitting = true;
		try {
			const username = auth.username;
			if (!username) throw new Error('Session expired');
			const result = await authApi.login(username, password);
			setToken(result.token);
			const encryptionKey = await deriveKeyFromPassword(password, username);
			storeKey(encryptionKey);
			const legacyKey = await deriveLegacyKey(password, username);
			storeLegacyKey(legacyKey);
			markVerified();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Verification failed';
		} finally {
			submitting = false;
			password = '';
		}
	}
</script>

{#if gated}
	<div class="gate">
		<div class="gate-card">
			<Text as="h2">Verify your identity</Text>
			<Text variant="muted">For your security, please re-enter your password.</Text>
			<form onsubmit={handleSubmit}>
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
					{submitting ? 'Verifying…' : 'Continue'}
				</Button>
			</form>
		</div>
	</div>
{:else}
	{@render children()}
{/if}

<style>
	.gate {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		padding: var(--space-md);
	}

	.gate-card {
		max-width: 24rem;
		width: 100%;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		padding: var(--space-xl);
		box-shadow: var(--shadow-md);
	}

	.gate-card :global(h2) {
		margin: 0 0 var(--space-sm);
	}

	.gate-card :global(p) {
		color: var(--color-text-muted);
		font-size: var(--text-sm);
		margin: 0 0 var(--space-lg);
	}

	form {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}
</style>
