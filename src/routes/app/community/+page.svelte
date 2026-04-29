<script lang="ts">
	import { auth } from '$lib/client/auth.svelte';
	import { communityApi, type CommunityPost } from '$lib/client/api';
	import { _ } from 'svelte-i18n';
	import Button from '$lib/components/ui/Button.svelte';
	import Text from '$lib/components/ui/Text.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import FlashMessage from '$lib/components/display/FlashMessage.svelte';
	import Input from '$lib/components/forms/Input.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';

	let posts = $state<CommunityPost[]>([]);
	let loading = $state(true);
	let flash = $state<{ text: string; type: 'success' | 'error' } | null>(null);
	let submitting = $state(false);
	let newPostDialog = $state<Dialog>(null!);

	let newTitle = $state('');
	let newDescription = $state('');
	let votedIds = $state<Set<string>>(new Set());

	let editingId = $state<string | null>(null);
	let editTitle = $state('');
	let editDescription = $state('');
	let editSaving = $state(false);

	// let dialog: Dialog;

	function showFlash(text: string, type: 'success' | 'error') {
		flash = { text, type };
		setTimeout(() => (flash = null), 4000);
	}

	async function loadPosts() {
		loading = true;
		try {
			posts = await communityApi.getPosts('feature_request');
		} catch (err) {
			showFlash(err instanceof Error ? err.message : $_('community.loadError'), 'error');
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		loadPosts();
	});

	async function vote(post: CommunityPost) {
		if (!auth.loggedIn) {
			showFlash($_('community.loginToVote'), 'error');
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
			showFlash(err instanceof Error ? err.message : $_('community.voteError'), 'error');
		}
	}

	function startEdit(post: CommunityPost) {
		editingId = post.id;
		editTitle = post.title;
		editDescription = post.description;
	}

	function cancelEdit() {
		editingId = null;
		editTitle = '';
		editDescription = '';
	}

	async function saveEdit(post: CommunityPost) {
		if (!editTitle.trim() || !editDescription.trim()) {
			showFlash($_('community.validationError'), 'error');
			return;
		}
		editSaving = true;
		try {
			await communityApi.updatePost(post.id, editTitle.trim(), editDescription.trim());
			post.title = editTitle.trim();
			post.description = editDescription.trim();
			editingId = null;
			showFlash($_('community.saveSuccess'), 'success');
		} catch (err) {
			showFlash(err instanceof Error ? err.message : $_('community.saveError'), 'error');
		} finally {
			editSaving = false;
		}
	}

	async function deletePost(post: CommunityPost) {
		if (!confirm($_('community.deleteConfirm'))) return;
		try {
			await communityApi.deletePost(post.id);
			posts = posts.filter((p: CommunityPost) => p.id !== post.id);
			showFlash($_('community.deleteSuccess'), 'success');
		} catch (err) {
			showFlash(err instanceof Error ? err.message : $_('community.deleteError'), 'error');
		}
	}

	async function submitPost() {
		if (!newTitle.trim() || !newDescription.trim()) {
			showFlash($_('community.validationError'), 'error');
			return;
		}
		submitting = true;
		try {
			await communityApi.createPost('feature_request', newTitle.trim(), newDescription.trim());
			newTitle = '';
			newDescription = '';
			newPostDialog.close();
			showFlash($_('community.submitSuccess'), 'success');
			await loadPosts();
		} catch (err) {
			showFlash(err instanceof Error ? err.message : $_('community.submitError'), 'error');
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
	<title>{$_('community.pageTitle')}</title>
</svelte:head>

<Text as="h2">{$_('community.title')}</Text>

<FlashMessage message={flash} />

{#if auth.loggedIn && !auth.isDemo}
	<Button variant="outline" onclick={() => newPostDialog.open()}>
		{$_('community.requestFeature')}
	</Button>

	<Dialog bind:this={newPostDialog} header={$_('community.newRequest')}>
		<Input
			label={$_('community.titleLabel')}
			bind:value={newTitle}
			maxlength={200}
			placeholder={$_('community.titlePlaceholder')}
		/>
		<div class="textarea-field">
			<label for="post-description">{$_('community.descriptionLabel')}</label>
			<textarea
				id="post-description"
				bind:value={newDescription}
				maxlength={2000}
				rows={4}
				placeholder={$_('community.descriptionPlaceholder')}
			></textarea>
		</div>

		{#snippet footer()}
			<Button variant="ghost" onclick={() => { newPostDialog.close(); newTitle = ''; newDescription = ''; }}>
				{$_('common.cancel')}
			</Button>
			<Button variant="primary" disabled={submitting} onclick={submitPost}>
				{submitting ? $_('community.submitting') : $_('community.submit')}
			</Button>
		{/snippet}
	</Dialog>
{/if}

{#if loading}
	<Text variant="muted">{$_('common.loading')}</Text>
{:else if posts.length === 0}
	<Text variant="muted">{$_('community.noPosts')}</Text>
{:else}
	<ul class="post-list">
		{#each posts as post (post.id)}
			<li class="post-card">
				<button
					class="vote-btn"
					class:voted={votedIds.has(post.id)}
					disabled={!auth.loggedIn}
					onclick={() => vote(post)}
					title={auth.loggedIn ? $_('community.upvote') : $_('community.loginToVote')}
				>
					▲<br />{post.votes}
				</button>
				<div class="post-body">
					{#if editingId === post.id}
						<Input label={$_('community.titleLabel')} bind:value={editTitle} maxlength={200} />
						<div class="textarea-field">
							<label for="edit-description-{post.id}">{$_('community.descriptionLabel')}</label>
							<textarea
								id="edit-description-{post.id}"
								bind:value={editDescription}
								maxlength={2000}
								rows={4}
							></textarea>
						</div>
						<div class="form-actions">
							<Button variant="primary" disabled={editSaving} onclick={() => saveEdit(post)}>
								{editSaving ? $_('community.saving') : $_('common.save')}
							</Button>
							<Button variant="ghost" onclick={cancelEdit}>{$_('common.cancel')}</Button>
						</div>
					{:else}
						<Text as="h4">{post.title}</Text>
						<p class="description">{post.description}</p>
						<div class="post-footer">
							<span class="meta">{formatDate(post.created_at)}</span>
							{#if auth.loggedIn && post.user_id === auth.userId}
								<Button variant="ghost" size="sm" onclick={() => startEdit(post)}>
									<Icon name="pencil" size={14} />
									{$_('common.edit')}
								</Button>
								<Button variant="ghost" size="sm" onclick={() => deletePost(post)}>
									<Icon name="trash-2" size={14} />
									{$_('common.delete')}
								</Button>
							{/if}
						</div>
					{/if}
				</div>
			</li>
		{/each}
	</ul>
{/if}

<style>
	.mb-1 {
		margin-bottom: 0.25rem;
	}

	.textarea-field {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.textarea-field label {
		font-size: var(--text-sm);
		font-weight: 500;
		color: var(--color-text);
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

	.post-footer {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
	}

	.meta {
		font-size: var(--text-xs);
		color: var(--color-text-muted);
		flex: 1;
	}
</style>
