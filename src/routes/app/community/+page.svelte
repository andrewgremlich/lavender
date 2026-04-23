<script lang="ts">
	import { auth } from '$lib/client/auth.svelte';
	import { communityApi, type CommunityPost, type PostType } from '$lib/client/api';
	import Button from '$lib/components/ui/Button.svelte';
	import Text from '$lib/components/ui/Text.svelte';
	import FlashMessage from '$lib/components/display/FlashMessage.svelte';
	import SettingsCard from '$lib/components/layout/SettingsCard.svelte';
	import Input from '$lib/components/forms/Input.svelte';

	type Tab = PostType;

	let activeTab = $state<Tab>('feature_request');
	let posts = $state<CommunityPost[]>([]);
	let loading = $state(true);
	let flash = $state<{ text: string; type: 'success' | 'error' } | null>(null);
	let showForm = $state(false);
	let submitting = $state(false);

	let newTitle = $state('');
	let newDescription = $state('');
	let votedIds = $state<Set<string>>(new Set());

	function showFlash(text: string, type: 'success' | 'error') {
		flash = { text, type };
		setTimeout(() => (flash = null), 4000);
	}

	async function loadPosts() {
		loading = true;
		try {
			posts = await communityApi.getPosts(activeTab);
		} catch (err) {
			showFlash(err instanceof Error ? err.message : 'Failed to load posts', 'error');
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		activeTab;
		loadPosts();
	});

	async function vote(post: CommunityPost) {
		if (!auth.loggedIn) {
			showFlash('Log in to vote', 'error');
			return;
		}
		try {
			const res = await communityApi.vote(post.id);
			post.votes = res.votes;
			if (res.voted) {
				votedIds.add(post.id);
			} else {
				votedIds.delete(post.id);
			}
			votedIds = new Set(votedIds);
		} catch (err) {
			showFlash(err instanceof Error ? err.message : 'Vote failed', 'error');
		}
	}

	async function submitPost() {
		if (!newTitle.trim() || !newDescription.trim()) {
			showFlash('Title and description required', 'error');
			return;
		}
		submitting = true;
		try {
			await communityApi.createPost(activeTab, newTitle.trim(), newDescription.trim());
			newTitle = '';
			newDescription = '';
			showForm = false;
			showFlash('Post submitted!', 'success');
			await loadPosts();
		} catch (err) {
			showFlash(err instanceof Error ? err.message : 'Submit failed', 'error');
		} finally {
			submitting = false;
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
	<title>Community — Lavender</title>
</svelte:head>

<Text as="h2">Community</Text>

<FlashMessage message={flash} />

<div class="tabs">
	<button
		class="tab"
		class:active={activeTab === 'feature_request'}
		onclick={() => {
			activeTab = 'feature_request';
			showForm = false;
		}}
	>
		Feature Requests
	</button>
	<button
		class="tab"
		class:active={activeTab === 'question'}
		onclick={() => {
			activeTab = 'question';
			showForm = false;
		}}
	>
		Q&amp;A
	</button>
</div>

{#if auth.loggedIn && !auth.isDemo}
	<div class="form-toggle">
		{#if !showForm}
			<Button variant="outline" onclick={() => (showForm = true)}>
				{activeTab === 'feature_request' ? '+ Request a Feature' : '+ Ask a Question'}
			</Button>
		{:else}
			<SettingsCard
				title={activeTab === 'feature_request' ? 'New Feature Request' : 'New Question'}
			>
				<Input label="Title" bind:value={newTitle} maxlength={200} placeholder="Short summary…" />
				<div class="textarea-field">
					<label for="post-description">Description</label>
					<textarea
						id="post-description"
						bind:value={newDescription}
						maxlength={2000}
						rows={4}
						placeholder="More detail…"
					></textarea>
				</div>
				<div class="form-actions">
					<Button variant="primary" disabled={submitting} onclick={submitPost}>
						{submitting ? 'Submitting…' : 'Submit'}
					</Button>
					<Button
						variant="ghost"
						onclick={() => {
							showForm = false;
							newTitle = '';
							newDescription = '';
						}}
					>
						Cancel
					</Button>
				</div>
			</SettingsCard>
		{/if}
	</div>
{/if}

{#if loading}
	<Text variant="muted">Loading…</Text>
{:else if posts.length === 0}
	<Text variant="muted">
		No {activeTab === 'feature_request' ? 'feature requests' : 'questions'} yet. Be the first!
	</Text>
{:else}
	<ul class="post-list">
		{#each posts as post (post.id)}
			<li class="post-card">
				<button
					class="vote-btn"
					class:voted={votedIds.has(post.id)}
					disabled={!auth.loggedIn}
					onclick={() => vote(post)}
					title={auth.loggedIn ? 'Upvote' : 'Log in to vote'}
				>
					▲<br />{post.votes}
				</button>
				<div class="post-body">
					<Text as="h4">{post.title}</Text>
					<p class="description">{post.description}</p>
					<span class="meta">{formatDate(post.created_at)}</span>
				</div>
			</li>
		{/each}
	</ul>
{/if}

<style>
	.tabs {
		display: flex;
		gap: var(--space-xs);
		margin-bottom: var(--space-lg);
		border-bottom: 2px solid var(--color-border);
	}

	.tab {
		background: none;
		border: none;
		padding: var(--space-sm) var(--space-md);
		font-size: var(--text-sm);
		font-weight: 600;
		color: var(--color-text-muted);
		cursor: pointer;
		border-bottom: 2px solid transparent;
		margin-bottom: -2px;
		transition: color 0.15s, border-color 0.15s;
	}

	.tab.active {
		color: var(--color-primary);
		border-bottom-color: var(--color-primary);
	}

	.form-toggle {
		margin-bottom: var(--space-lg);
	}

	.textarea-field {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.textarea-field label {
		font-size: var(--text-sm);
		font-weight: 500;
	}

	.textarea-field textarea {
		font: inherit;
		padding: 0.625rem 0.75rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-text);
		font-size: var(--text-base);
		width: 100%;
		resize: vertical;
		color-scheme: light dark;
		box-sizing: border-box;
	}

	.textarea-field textarea:focus {
		outline: none;
		border-color: var(--color-border-focus, #a78bfa);
		box-shadow: 0 0 0 3px var(--color-primary-alpha, rgba(124, 58, 237, 0.12));
	}

	.form-actions {
		display: flex;
		gap: var(--space-sm);
	}

	.post-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}

	.post-card {
		display: flex;
		gap: var(--space-md);
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		padding: var(--space-md);
		box-shadow: var(--shadow-sm);
	}

	.vote-btn {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-width: 3rem;
		padding: var(--space-xs);
		background: var(--color-bg);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		font-size: var(--text-sm);
		font-weight: 700;
		color: var(--color-text-muted);
		cursor: pointer;
		transition:
			background 0.15s,
			color 0.15s,
			border-color 0.15s;
		line-height: 1.3;
	}

	.vote-btn:hover:not(:disabled) {
		border-color: var(--color-primary);
		color: var(--color-primary);
	}

	.vote-btn.voted {
		background: var(--color-primary-alpha);
		border-color: var(--color-primary);
		color: var(--color-primary);
	}

	.vote-btn:disabled {
		cursor: default;
	}

	.post-body {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.description {
		font-size: var(--text-sm);
		color: var(--color-text);
		margin: 0;
		white-space: pre-wrap;
	}

	.meta {
		font-size: var(--text-xs);
		color: var(--color-text-muted);
	}
</style>
