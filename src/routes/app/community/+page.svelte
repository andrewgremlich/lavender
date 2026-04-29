<script lang="ts">
	import { auth } from '$lib/client/auth.svelte';
	import { communityApi, type CommunityPost } from '$lib/client/api';
	import { _ } from 'svelte-i18n';
	import Button from '$lib/components/ui/Button.svelte';
	import Text from '$lib/components/ui/Text.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import FlashMessage from '$lib/components/display/FlashMessage.svelte';
	import Input from '$lib/components/forms/Input.svelte';
	import PostCard from '$lib/components/display/PostCard.svelte';

	let posts = $state<CommunityPost[]>([]);
	let loading = $state(true);
	let flash = $state<{ text: string; type: 'success' | 'error' } | null>(null);
	let submitting = $state(false);
	let newPostDialog = $state<Dialog>(null!);

	let newTitle = $state('');
	let newDescription = $state('');
	let votedIds = $state<Set<string>>(new Set());

	const hasExistingPost = $derived(
		auth.loggedIn && posts.some((p: CommunityPost) => p.user_id === auth.userId)
	);

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
</script>

<svelte:head>
	<title>{$_('community.pageTitle')}</title>
</svelte:head>

<Text as="h2">{$_('community.title')}</Text>

<FlashMessage message={flash} />

{#if auth.loggedIn && !auth.isDemo}
	<div class="request-feature">
		<Button variant="outline" disabled={hasExistingPost} onclick={() => newPostDialog.open()}>
			{$_('community.requestFeature')}
		</Button>
		{#if hasExistingPost}
			<span class="limit-notice">{$_('community.maxOneRequest')}</span>
		{/if}
	</div>

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
		{#each posts as post, i (post.id)}
			<PostCard
				{post}
				index={i}
				voted={votedIds.has(post.id)}
				canEdit={auth.loggedIn && post.user_id === auth.userId}
				loggedIn={auth.loggedIn}
				onvote={() => vote(post)}
				onsave={async (title, description) => {
					await communityApi.updatePost(post.id, title, description);
					post.title = title;
					post.description = description;
					showFlash($_('community.saveSuccess'), 'success');
				}}
				ondelete={() => deletePost(post)}
			/>
		{/each}
	</ul>
{/if}

<style>
	.request-feature {
		margin-bottom: 1rem;
		display: flex;
		align-items: center;
		gap: var(--space-sm);
	}

	.limit-notice {
		font-size: var(--text-sm);
		color: var(--color-text-muted);
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

	.post-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}
</style>
