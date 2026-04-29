<script lang="ts">
	import { stripeApi } from '$lib/client/api';
	import { auth } from '$lib/client/auth.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import FlashMessage from '$lib/components/display/FlashMessage.svelte';
	import SettingsCard from '$lib/components/layout/SettingsCard.svelte';
	import Text from '$lib/components/ui/Text.svelte';

	let loading = $state(false);
	let msg = $state<{ text: string; type: 'success' | 'error' } | null>(null);

	function flash(text: string, type: 'success' | 'error') {
		msg = { text, type };
		setTimeout(() => (msg = null), 5000);
	}

	async function upgrade() {
		loading = true;
		try {
			const { url } = await stripeApi.createCheckoutSession();
			window.location.href = url;
		} catch (err) {
			loading = false;
			flash(err instanceof Error ? err.message : 'Could not start checkout', 'error');
		}
	}

	async function openPortal() {
		loading = true;
		try {
			const { url } = await stripeApi.createPortalSession();
			window.location.href = url;
		} catch (err) {
			loading = false;
			flash(err instanceof Error ? err.message : 'Could not open billing portal', 'error');
		}
	}
</script>

<SettingsCard title="Subscription">
	{#if auth.isPro}
		<Text variant="muted">You're on the Pro plan — unlimited entries.</Text>
		<Button type="button" variant="outline" onclick={openPortal} disabled={loading}>
			{loading ? 'Redirecting…' : 'Manage Billing'}
		</Button>
	{:else}
		<Text variant="muted">Free plan — up to 14 entries per month.</Text>
		<Button type="button" onclick={upgrade} disabled={loading}>
			{loading ? 'Redirecting…' : 'Upgrade to Pro'}
		</Button>
	{/if}
	<FlashMessage message={msg} />
</SettingsCard>
