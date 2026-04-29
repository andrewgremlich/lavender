<script lang="ts">
	import { _ } from 'svelte-i18n';
	import Button from '$lib/components/ui/Button.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Input from '$lib/components/forms/Input.svelte';
	import Text from '$lib/components/ui/Text.svelte';
	import type { CommunityPost } from '$lib/client/api';

	type Props = {
		post: CommunityPost;
		voted: boolean;
		canEdit: boolean;
		loggedIn: boolean;
		index?: number;
		onvote: () => void;
		onsave: (title: string, description: string) => Promise<void>;
		ondelete: () => void;
	};

	let { post, voted, canEdit, loggedIn, index = 0, onvote, onsave, ondelete }: Props = $props();

	let editing = $state(false);
	let editTitle = $state('');
	let editDescription = $state('');
	let editSaving = $state(false);

	function startEdit() {
		editTitle = post.title;
		editDescription = post.description;
		editing = true;
	}

	function cancelEdit() {
		editing = false;
		editTitle = '';
		editDescription = '';
	}

	async function saveEdit() {
		editSaving = true;
		try {
			await onsave(editTitle.trim(), editDescription.trim());
			editing = false;
			editTitle = '';
			editDescription = '';
		} finally {
			editSaving = false;
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

<li class="post-card appear" style="animation-delay: {index * 50}ms">
	<button
		class="vote-btn"
		class:voted
		disabled={!loggedIn}
		onclick={onvote}
		title={loggedIn ? $_('community.upvote') : $_('community.loginToVote')}
	>
		▲<br />{post.votes}
	</button>
	<div class="post-body">
		{#if editing}
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
				<Button variant="primary" disabled={editSaving} onclick={saveEdit}>
					{editSaving ? $_('community.saving') : $_('common.save')}
				</Button>
				<Button variant="ghost" onclick={cancelEdit}>{$_('common.cancel')}</Button>
			</div>
		{:else}
			<Text as="h4">{post.title}</Text>
			<p class="description">{post.description}</p>
			<div class="post-footer">
				<span class="meta">{formatDate(post.created_at)}</span>
				{#if canEdit}
					<Button variant="ghost" size="sm" onclick={startEdit}>
						<Icon name="pencil" size={14} />
						{$_('common.edit')}
					</Button>
					<Button variant="ghost" size="sm" onclick={ondelete}>
						<Icon name="trash-2" size={14} />
						{$_('common.delete')}
					</Button>
				{/if}
			</div>
		{/if}
	</div>
</li>

<style>
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
</style>
