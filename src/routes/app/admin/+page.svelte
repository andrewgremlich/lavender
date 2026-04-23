<script lang="ts">
	import { goto } from '$app/navigation';
	import { auth } from '$lib/client/auth.svelte';
	import { adminApi, type AdminUser } from '$lib/client/api';
	import type { Role } from '$lib/types';
	import Button from '$lib/components/ui/Button.svelte';
	import FlashMessage from '$lib/components/display/FlashMessage.svelte';
	import SettingsCard from '$lib/components/layout/SettingsCard.svelte';
	import Text from '$lib/components/ui/Text.svelte';
	import { communityApi, type CommunityPost } from '$lib/client/api';

	let users = $state<AdminUser[]>([]);
	let posts = $state<CommunityPost[]>([]);
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
		Promise.all([adminApi.getUsers(), communityApi.getPosts()])
			.then(([userList, postList]) => {
				users = userList;
				posts = postList;
			})
			.catch((err) => {
				showFlash(err instanceof Error ? err.message : 'Failed to load data', 'error');
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
	{#if loading}
		<Text variant="muted">Loading…</Text>
	{:else if posts.length === 0}
		<Text variant="muted">No community posts yet.</Text>
	{:else}
		<div class="table-wrap">
			<table>
				<thead>
					<tr>
						<th>Type</th>
						<th>Title</th>
						<th>Votes</th>
						<th>Posted</th>
						<th>Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each posts as post (post.id)}
						<tr>
							<td><span class="post-type post-type--{post.type}">{post.type === 'feature_request' ? 'Feature' : 'Q&A'}</span></td>
							<td>{post.title}</td>
							<td>{post.votes}</td>
							<td>{formatDate(post.created_at)}</td>
							<td class="actions">
								<Button
									variant="ghost"
									size="sm"
									onclick={async () => {
										if (!confirm(`Delete post "${post.title}"?`)) return;
										try {
											await communityApi.deletePost(post.id);
											posts = posts.filter((p) => p.id !== post.id);
											showFlash('Post deleted', 'success');
										} catch (err) {
											showFlash(err instanceof Error ? err.message : 'Failed to delete post', 'error');
										}
									}}
								>Delete</Button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
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

	.post-type {
		padding: 2px var(--space-xs);
		border-radius: var(--radius-sm);
		font-size: var(--text-xs);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.post-type--feature_request {
		background: #dbeafe;
		color: #1d4ed8;
	}

	.post-type--question {
		background: #d1fae5;
		color: #065f46;
	}
</style>
