<script lang="ts">
	import { goto } from '$app/navigation';
	import { auth } from '$lib/client/auth.svelte';

	let { children } = $props();

	// Redirect unauthenticated users to sign-in. This runs on the client only
	// (no SSR for the app shell); the server already rejects unauthenticated
	// `/api/*` calls via `hooks.server.ts`.
	$effect(() => {
		if (!auth.loggedIn) {
			goto('/auth/login', { replaceState: true });
		}
	});
</script>

{#if auth.loggedIn}
	{@render children()}
{/if}
