<script lang="ts">
	import { goto } from '$app/navigation';
	import { auth } from '$lib/client/auth.svelte';
	import { adminApi, type AdminUser } from '$lib/client/api';
	import type { Role } from '$lib/types';
	import Button from '$lib/components/ui/Button.svelte';
	import FlashMessage from '$lib/components/display/FlashMessage.svelte';
	import SettingsCard from '$lib/components/layout/SettingsCard.svelte';
	import Text from '$lib/components/ui/Text.svelte';

	let users = $state<AdminUser[]>([]);
	let loading = $state(true);
	let flash = $state<{ text: string; type: 'success' | 'error' } | null>(null);

	function showFlash(text: string, type: 'success' | 'error') {
		flash = { text, type };
		setTimeout(() => (flash = null), 4000);
	}

	$effect(() => {
		if (!auth.loggedIn || auth.role !== 'admin') {
			goto('/app', { replaceState: true });
			return;
		}
		adminApi
			.getUsers()
			.then((list) => {
				users = list;
			})
			.catch((err) => {
				showFlash(err instanceof Error ? err.message : 'Failed to load users', 'error');
			})
			.finally(() => {
				loading = false;
			});
	});

	async function setRole(user: AdminUser, role: Role) {
		try {
			await adminApi.setUserRole(user.id, role);
			user.role = role;
			showFlash(`${user.username} role set to ${role}`, 'success');
		} catch (err) {
			showFlash(err instanceof Error ? err.message : 'Failed to update role', 'error');
		}
	}

	async function deleteUser(user: AdminUser) {
		if (!confirm(`Delete user "${user.username}"? This cannot be undone.`)) return;
		try {
			await adminApi.deleteUser(user.id);
			users = users.filter((u) => u.id !== user.id);
			showFlash(`${user.username} deleted`, 'success');
		} catch (err) {
			showFlash(err instanceof Error ? err.message : 'Failed to delete user', 'error');
		}
	}

	function formatDate(iso: string) {
		return new Date(iso).toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}
</script>

<svelte:head>
	<title>Admin — Lavender</title>
</svelte:head>

<Text as="h2">Admin Panel</Text>

<FlashMessage message={flash} />

<SettingsCard title="User Management">
	{#if loading}
		<Text variant="muted">Loading users…</Text>
	{:else if users.length === 0}
		<Text variant="muted">No users found.</Text>
	{:else}
		<div class="table-wrap">
			<table>
				<thead>
					<tr>
						<th>Username</th>
						<th>Role</th>
						<th>Joined</th>
						<th>Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each users as user (user.id)}
						{@const isSelf = user.username === auth.username}
						<tr class:self={isSelf}>
							<td>{user.username}{#if isSelf} <span class="you">(you)</span>{/if}</td>
							<td><span class="role role--{user.role}">{user.role}</span></td>
							<td>{formatDate(user.created_at)}</td>
							<td class="actions">
								{#if !isSelf}
									{#if user.role === 'banned'}
										<Button
											variant="outline"
											size="sm"
											onclick={() => setRole(user, 'user')}
										>Unban</Button>
									{:else}
										<Button
											variant="outline"
											size="sm"
											onclick={() => setRole(user, 'banned')}
										>Ban</Button>
									{/if}
									{#if user.role !== 'admin'}
										<Button
											variant="outline"
											size="sm"
											onclick={() => setRole(user, 'admin')}
										>Promote</Button>
									{:else}
										<Button
											variant="outline"
											size="sm"
											onclick={() => setRole(user, 'user')}
										>Demote</Button>
									{/if}
									<Button
										variant="ghost"
										size="sm"
										onclick={() => deleteUser(user)}
									>Delete</Button>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</SettingsCard>

<SettingsCard title="Community Posts">
	<Text variant="muted">Community posts management coming in ROADMAP step 16.</Text>
</SettingsCard>

<style>
	.table-wrap {
		overflow-x: auto;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--text-sm);
	}

	th {
		text-align: left;
		padding: var(--space-xs) var(--space-sm);
		border-bottom: 2px solid var(--color-border);
		color: var(--color-text-muted);
		font-weight: 600;
		white-space: nowrap;
	}

	td {
		padding: var(--space-xs) var(--space-sm);
		border-bottom: 1px solid var(--color-border);
		vertical-align: middle;
	}

	tr.self td {
		background: var(--color-primary-alpha);
	}

	.you {
		font-size: var(--text-xs);
		color: var(--color-text-muted);
	}

	.role {
		padding: 2px var(--space-xs);
		border-radius: var(--radius-sm);
		font-size: var(--text-xs);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.role--admin {
		background: #dbeafe;
		color: #1d4ed8;
	}

	.role--user {
		background: var(--color-surface);
		color: var(--color-text-muted);
		border: 1px solid var(--color-border);
	}

	.role--demo {
		background: #fef9c3;
		color: #854d0e;
	}

	.role--banned {
		background: #fee2e2;
		color: #b91c1c;
	}

	.actions {
		display: flex;
		gap: var(--space-xs);
		flex-wrap: wrap;
	}
</style>
