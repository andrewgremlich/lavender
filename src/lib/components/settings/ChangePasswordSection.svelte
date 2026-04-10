<script lang="ts">
	import { authApi, metricsApi, setToken } from '$lib/client/api';
	import { auth } from '$lib/client/auth.svelte';
	import {
		decrypt,
		deriveKeyFromPassword,
		encrypt,
		getStoredKey,
		importKey,
		storeKey
	} from '$lib/client/crypto';
	import { _ } from 'svelte-i18n';
	import Button from '$lib/components/ui/Button.svelte';
	import FlashMessage from '$lib/components/display/FlashMessage.svelte';
	import Input from '$lib/components/forms/Input.svelte';
	import SettingsCard from '$lib/components/layout/SettingsCard.svelte';
	import Text from '$lib/components/ui/Text.svelte';

	let msg = $state<{ text: string; type: 'success' | 'error' } | null>(null);
	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');
	let changing = $state(false);

	function flash(text: string, type: 'success' | 'error') {
		msg = { text, type };
		setTimeout(() => (msg = null), 4000);
	}

	const reqs = $derived({
		length: newPassword.length >= 12,
		number: /\d/.test(newPassword),
		special: /[^a-zA-Z0-9]/.test(newPassword)
	});

	function isPasswordValid(pw: string): boolean {
		return pw.length >= 12 && /\d/.test(pw) && /[^a-zA-Z0-9]/.test(pw);
	}

	async function changePassword() {
		if (!currentPassword || !newPassword || !confirmPassword) {
			flash($_('settings.changePassword.allFieldsRequired'), 'error');
			return;
		}
		if (newPassword !== confirmPassword) {
			flash($_('settings.changePassword.passwordsMismatch'), 'error');
			return;
		}
		if (!isPasswordValid(newPassword)) {
			flash($_('settings.changePassword.passwordRequirementsNotMet'), 'error');
			return;
		}
		if (currentPassword === newPassword) {
			flash($_('settings.changePassword.passwordSameAsCurrent'), 'error');
			return;
		}

		const storedKey = getStoredKey();
		if (!storedKey) {
			flash($_('settings.changePassword.keyNotFound'), 'error');
			return;
		}
		const username = auth.username;
		if (!username) {
			flash($_('settings.changePassword.notAuthenticated'), 'error');
			return;
		}

		changing = true;
		try {
			const entries = await metricsApi.getAll();
			const oldKey = await importKey(storedKey);
			const newDerivedKey = await deriveKeyFromPassword(newPassword, username);
			const newCryptoKey = await importKey(newDerivedKey);

			const reEncrypted = await Promise.all(
				entries.map(async (entry) => {
					const plaintext = await decrypt(entry.encryptedData, entry.iv, oldKey);
					const { encrypted, iv } = await encrypt(plaintext, newCryptoKey);
					return { id: entry.id, encryptedData: encrypted, iv };
				})
			);

			const result = await authApi.changePassword(currentPassword, newPassword, reEncrypted);
			setToken(result.token);
			storeKey(newDerivedKey);

			currentPassword = '';
			newPassword = '';
			confirmPassword = '';
			flash($_('settings.changePassword.success'), 'success');
		} catch (err) {
			flash(
				err instanceof Error ? err.message : $_('settings.changePassword.changeFailed'),
				'error'
			);
		} finally {
			changing = false;
		}
	}
</script>

<SettingsCard title={$_('settings.changePassword.title')}>
	<Text variant="muted">
		{$_('settings.changePassword.description')}
	</Text>
	<Input
		label={$_('settings.changePassword.currentPassword')}
		id="current-pw"
		type="password"
		autocomplete="current-password"
		bind:value={currentPassword}
	/>
	<Input
		label={$_('settings.changePassword.newPassword')}
		id="new-pw"
		type="password"
		autocomplete="new-password"
		bind:value={newPassword}
	/>
	<Input
		label={$_('settings.changePassword.confirmPassword')}
		id="confirm-pw"
		type="password"
		autocomplete="new-password"
		bind:value={confirmPassword}
	/>
	<ul class="requirements">
		<li class:met={reqs.length}>{$_('settings.changePassword.requirements.length')}</li>
		<li class:met={reqs.number}>{$_('settings.changePassword.requirements.number')}</li>
		<li class:met={reqs.special}>{$_('settings.changePassword.requirements.special')}</li>
	</ul>
	<Button type="button" onclick={changePassword} disabled={changing}>
		{changing ? $_('settings.changePassword.changing') : $_('settings.changePassword.change')}
	</Button>
	<FlashMessage message={msg} />
</SettingsCard>

<style>
	.requirements {
		font-size: var(--text-xs);
		color: var(--color-text-muted);
		padding-left: var(--space-md);
		list-style: disc;
	}

	.requirements li.met {
		color: var(--color-success);
	}
</style>
