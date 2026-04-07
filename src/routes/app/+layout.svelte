<script lang="ts">
	import { goto } from '$app/navigation';
	import { auth } from '$lib/client/auth.svelte';
	import { entriesStore } from '$lib/client/entries.svelte';
	import { syncEngine } from '$lib/services/sync-engine';
	import NavBar from '$lib/components/NavBar.svelte';

	let { children } = $props();

	// Redirect unauthenticated users to sign-in. Runs on the client only
	// (no SSR for the app shell); the server already rejects unauthenticated
	// `/api/*` calls via `hooks.server.ts`.
	$effect(() => {
		if (!auth.loggedIn) {
			goto('/auth/login', { replaceState: true });
		}
	});

	// Start the sync engine and entries store once we know we're logged in.
	$effect(() => {
		if (!auth.loggedIn) return;
		syncEngine.init();
		entriesStore.startSyncListener();
		void entriesStore.load();
		return () => entriesStore.stopSyncListener();
	});
</script>

{#if auth.loggedIn}
	<div class="app-shell">
		<NavBar />
		<main class="content">
			{@render children()}
		</main>
	</div>
{/if}

<style>
	.app-shell {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
		padding-bottom: var(--nav-height);
	}

	.content {
		flex: 1;
		padding: var(--space-md);
		padding-bottom: calc(var(--space-md) + var(--nav-height));
		max-width: var(--content-max-width);
		margin: 0 auto;
		width: 100%;
	}

	@media (min-width: 768px) {
		.content {
			padding: var(--space-lg);
			padding-bottom: calc(var(--space-lg) + var(--nav-height));
		}
	}

	@media (min-width: 1024px) {
		.app-shell {
			flex-direction: row;
			padding-bottom: 0;
		}

		.content {
			margin-left: var(--sidebar-width);
			padding: var(--space-xl);
		}
	}
</style>
