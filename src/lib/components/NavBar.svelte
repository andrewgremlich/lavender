<script lang="ts">
	import { page } from '$app/stores';
	import Icon from './Icon.svelte';
	import Button from './Button.svelte';
	import { sync } from '$lib/client/sync.svelte';

	let menuOpen = $state(false);

	const routes = [
		{ href: '/app', icon: 'house', label: 'Dashboard' },
		{ href: '/app/entry', icon: 'circle-plus', label: 'Add Entry' },
		{ href: '/app/analytics', icon: 'trending-up', label: 'Analytics', desktop: true },
		{ href: '/app/settings', icon: 'settings', label: 'Settings', desktop: true }
	] as const;

	const syncTitle = $derived(
		sync.status === 'synced'
			? 'All changes saved'
			: sync.status === 'pending'
				? 'Syncing changes…'
				: 'Sync error — will retry when online'
	);

	function isActive(href: string): boolean {
		const pathname = $page.url.pathname;
		if (href === '/app') return pathname === '/app';
		return pathname === href || pathname.startsWith(`${href}/`);
	}
</script>

<nav class="nav-bar">
	<div class="brand">
		<h1>Lavender</h1>
		<span class="sync-dot sync-dot--{sync.status}" title={syncTitle}></span>
	</div>

	{#each routes as route (route.href)}
		<a
			href={route.href}
			class="nav-item"
			class:active={isActive(route.href)}
			class:desktop-only={'desktop' in route && route.desktop}
		>
			<Icon name={route.icon} />
			<span class="label">{route.label}</span>
		</a>
	{/each}

	<Button
		variant="ghost"
		class="nav-item menu-toggle"
		aria-label="Open menu"
		aria-expanded={menuOpen}
		onclick={() => (menuOpen = !menuOpen)}
	>
		<Icon name="menu" />
		<span class="label">Menu</span>
	</Button>
</nav>

{#if menuOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="menu-overlay"
		onclick={(e) => {
			if (e.target === e.currentTarget) menuOpen = false;
		}}
	>
		<div class="menu-sheet" role="dialog" aria-label="Menu">
			{#each routes.filter((r) => 'desktop' in r && r.desktop) as route (route.href)}
				<a href={route.href} class="menu-item" onclick={() => (menuOpen = false)}>
					<Icon name={route.icon} />
					<span>{route.label}</span>
				</a>
			{/each}
		</div>
	</div>
{/if}

<style>
	.nav-bar {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		height: var(--nav-height);
		background: var(--color-surface);
		border-top: 1px solid var(--color-border);
		display: flex;
		align-items: center;
		justify-content: space-around;
		z-index: 100;
		box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.05);
		padding: 0 var(--space-sm);
	}

	.brand {
		display: none;
	}

	.nav-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2px;
		padding: var(--space-xs) var(--space-sm);
		color: var(--color-text);
		font-size: var(--text-xs);
		text-decoration: none;
		border-radius: var(--radius-md);
		transition:
			color var(--transition-fast),
			background-color var(--transition-fast);
		cursor: pointer;
		border: none;
		background: none;
		font-family: var(--font-sans);
	}

	.nav-item:hover {
		color: var(--color-primary);
		background-color: var(--color-primary-alpha);
	}

	.nav-item.active {
		color: var(--color-primary);
		font-weight: 600;
	}

	.label {
		font-size: var(--text-xs);
	}

	.desktop-only {
		display: none;
	}

	.nav-bar :global(.menu-toggle) {
		display: flex;
	}

	.sync-dot {
		display: inline-block;
		width: 8px;
		height: 8px;
		border-radius: 50%;
	}

	.sync-dot--synced {
		background: var(--color-success);
	}
	.sync-dot--pending {
		background: var(--color-warning);
		animation: pulse 1.2s ease-in-out infinite;
	}
	.sync-dot--error {
		background: var(--color-error);
	}

	@keyframes pulse {
		50% {
			opacity: 0.4;
		}
	}

	.menu-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: flex-end;
		justify-content: center;
		z-index: 200;
		padding: var(--space-md);
	}

	.menu-sheet {
		background: var(--color-surface);
		border-radius: var(--radius-xl) var(--radius-xl) 0 0;
		padding: var(--space-lg);
		width: 100%;
		max-width: 480px;
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.menu-item {
		display: flex;
		align-items: center;
		gap: var(--space-md);
		padding: var(--space-md);
		border-radius: var(--radius-md);
		color: var(--color-text);
		text-decoration: none;
	}

	.menu-item:hover {
		background: var(--color-primary-alpha);
	}

	@media (min-width: 1024px) {
		.nav-bar {
			top: 0;
			bottom: 0;
			right: auto;
			width: var(--sidebar-width);
			height: 100vh;
			flex-direction: column;
			justify-content: flex-start;
			padding: var(--space-xl) var(--space-md) var(--space-md);
			gap: var(--space-xs);
			border-top: none;
			border-right: 1px solid var(--color-border);
			box-shadow: 2px 0 10px rgba(0, 0, 0, 0.05);
			align-items: stretch;
		}

		.brand {
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: 0 var(--space-sm);
			margin-bottom: var(--space-lg);
		}

		.brand h1 {
			font-size: var(--text-xl);
			color: var(--color-primary);
		}

		.nav-item {
			flex-direction: row;
			justify-content: flex-start;
			padding: var(--space-sm) var(--space-md);
			font-size: var(--text-sm);
			gap: var(--space-sm);
		}

		.desktop-only {
			display: flex;
		}

		.nav-bar :global(.menu-toggle) {
			display: none;
		}
	}
</style>
