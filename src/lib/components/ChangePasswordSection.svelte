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
	import Button from './Button.svelte';
	import FlashMessage from './FlashMessage.svelte';
	import Input from './Input.svelte';
	import SettingsCard from './SettingsCard.svelte';
	import Text from './Text.svelte';

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
			flash('All fields are required.', 'error');
			return;
		}
		if (newPassword !== confirmPassword) {
			flash('New passwords do not match.', 'error');
			return;
		}
		if (!isPasswordValid(newPassword)) {
			flash('Password must be 12+ chars with a number and special character.', 'error');
			return;
		}
		if (currentPassword === newPassword) {
			flash('New password must differ from current.', 'error');
			return;
		}

		const storedKey = getStoredKey();
		if (!storedKey) {
			flash('Encryption key not found. Please log in again.', 'error');
			return;
		}
		const username = auth.username;
		if (!username) {
			flash('Not authenticated.', 'error');
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
			flash('Password changed successfully.', 'success');
		} catch (err) {
			flash(err instanceof Error ? err.message : 'Failed to change password.', 'error');
		} finally {
			changing = false;
		}
	}
</script>

<SettingsCard title="Change Password">
	<Text variant="muted">
		Changing your password will re-encrypt all your health data with a new key. This may take a
		moment.
	</Text>
	<Input
		label="Current password"
		id="current-pw"
		type="password"
		autocomplete="current-password"
		bind:value={currentPassword}
	/>
	<Input label="New password" id="new-pw" type="password" autocomplete="new-password" bind:value={newPassword} />
	<Input label="Confirm new password" id="confirm-pw" type="password" autocomplete="new-password" bind:value={confirmPassword} />
	<ul class="requirements">
		<li class:met={reqs.length}>At least 12 characters</li>
		<li class:met={reqs.number}>At least one number</li>
		<li class:met={reqs.special}>At least one special character</li>
	</ul>
	<Button type="button" onclick={changePassword} disabled={changing}>
		{changing ? 'Re-encrypting data…' : 'Change Password'}
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
