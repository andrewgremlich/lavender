<script lang="ts">
	import { stripeApi } from '$lib/client/api';
	import Button from '$lib/components/ui/Button.svelte';

	let loading = $state(false);

	async function upgrade() {
		loading = true;
		try {
			const { url } = await stripeApi.createCheckoutSession();
			window.location.href = url;
		} catch {
			loading = false;
		}
	}
</script>

<div class="banner">
	<p>You've reached the 14 entries/month limit on the free plan.</p>
	<Button type="button" onclick={upgrade} disabled={loading}>
		{loading ? 'Redirecting…' : 'Upgrade to Pro'}
	</Button>
</div>

<style>
	.banner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-sm);
		padding: var(--space-sm) var(--space-md);
		background: var(--color-primary-alpha);
		border: 1px solid var(--color-primary);
		border-radius: var(--radius-md);
		font-size: var(--text-sm);
	}

	p {
		margin: 0;
	}
</style>
