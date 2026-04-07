<script lang="ts">
	import { goto } from '$app/navigation';
	import { authApi, metricsApi, setToken, settingsApi } from '$lib/client/api';
	import { auth } from '$lib/client/auth.svelte';
	import {
		decrypt,
		deriveKeyFromPassword,
		encrypt,
		getStoredKey,
		importKey,
		storeKey
	} from '$lib/client/crypto';
	import { entriesStore } from '$lib/client/entries.svelte';
	import { metricsStore } from '$lib/services/metrics-store';
	import { getUnitSystem, setUnitSystem, type UnitSystem } from '$lib/utils/units';
	import Button from '$lib/components/Button.svelte';
	import Input from '$lib/components/Input.svelte';
	import Text from '$lib/components/Text.svelte';

	let unitSystem = $state<UnitSystem>(getUnitSystem());
	let retentionDays = $state(180);
	let unitsMsg = $state<{ text: string; type: 'success' | 'error' } | null>(null);
	let retentionMsg = $state<{ text: string; type: 'success' | 'error' } | null>(null);
	let passwordMsg = $state<{ text: string; type: 'success' | 'error' } | null>(null);
	let exportMsg = $state<{ text: string; type: 'success' | 'error' } | null>(null);

	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');
	let changing = $state(false);

	let confirmDeleteData = $state(false);
	let confirmDeleteAccount = $state(false);
	let dataDeleted = $state(false);

	$effect(() => {
		settingsApi
			.get()
			.then((s) => {
				retentionDays = s.dataRetentionDays;
			})
			.catch(() => {});
	});

	function flash(
		setter: (m: { text: string; type: 'success' | 'error' } | null) => void,
		text: string,
		type: 'success' | 'error'
	) {
		setter({ text, type });
		setTimeout(() => setter(null), 4000);
	}

	function saveUnits() {
		setUnitSystem(unitSystem);
		flash((m) => (unitsMsg = m), 'Unit preference saved.', 'success');
	}

	async function saveRetention() {
		try {
			await settingsApi.update({ dataRetentionDays: retentionDays });
			flash((m) => (retentionMsg = m), 'Retention period saved.', 'success');
		} catch (err) {
			flash(
				(m) => (retentionMsg = m),
				err instanceof Error ? err.message : 'Failed to save.',
				'error'
			);
		}
	}

	function isPasswordValid(pw: string): boolean {
		return pw.length >= 12 && /\d/.test(pw) && /[^a-zA-Z0-9]/.test(pw);
	}

	const reqs = $derived({
		length: newPassword.length >= 12,
		number: /\d/.test(newPassword),
		special: /[^a-zA-Z0-9]/.test(newPassword)
	});

	async function changePassword() {
		if (!currentPassword || !newPassword || !confirmPassword) {
			flash((m) => (passwordMsg = m), 'All fields are required.', 'error');
			return;
		}
		if (newPassword !== confirmPassword) {
			flash((m) => (passwordMsg = m), 'New passwords do not match.', 'error');
			return;
		}
		if (!isPasswordValid(newPassword)) {
			flash(
				(m) => (passwordMsg = m),
				'Password must be 12+ chars with a number and special character.',
				'error'
			);
			return;
		}
		if (currentPassword === newPassword) {
			flash((m) => (passwordMsg = m), 'New password must differ from current.', 'error');
			return;
		}

		const storedKey = getStoredKey();
		if (!storedKey) {
			flash((m) => (passwordMsg = m), 'Encryption key not found. Please log in again.', 'error');
			return;
		}
		const username = auth.username;
		if (!username) {
			flash((m) => (passwordMsg = m), 'Not authenticated.', 'error');
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
			flash((m) => (passwordMsg = m), 'Password changed successfully.', 'success');
		} catch (err) {
			flash(
				(m) => (passwordMsg = m),
				err instanceof Error ? err.message : 'Failed to change password.',
				'error'
			);
		} finally {
			changing = false;
		}
	}

	async function exportJson() {
		const storedKey = getStoredKey();
		if (!storedKey) {
			flash((m) => (exportMsg = m), 'Encryption key not found. Please log in again.', 'error');
			return;
		}
		try {
			const entries = await metricsApi.getAll();
			const key = await importKey(storedKey);
			const decrypted = await Promise.all(
				entries.map(async (entry) => {
					const plaintext = await decrypt(entry.encryptedData, entry.iv, key);
					return {
						id: entry.id,
						createdAt: entry.createdAt,
						expiresAt: entry.expiresAt,
						data: JSON.parse(plaintext)
					};
				})
			);
			const payload = {
				exportedAt: new Date().toISOString(),
				entryCount: decrypted.length,
				entries: decrypted
			};
			downloadBlob(
				JSON.stringify(payload, null, 2),
				'application/json',
				`lavender-backup-${new Date().toISOString().slice(0, 10)}.json`
			);
			flash((m) => (exportMsg = m), `Exported ${decrypted.length} entries.`, 'success');
		} catch (err) {
			flash((m) => (exportMsg = m), err instanceof Error ? err.message : 'Export failed.', 'error');
		}
	}

	async function exportCsv() {
		const storedKey = getStoredKey();
		if (!storedKey) {
			flash((m) => (exportMsg = m), 'Encryption key not found. Please log in again.', 'error');
			return;
		}
		try {
			const entries = await metricsApi.getAll();
			const key = await importKey(storedKey);
			const decrypted = await Promise.all(
				entries.map(async (entry) => {
					const plaintext = await decrypt(entry.encryptedData, entry.iv, key);
					return {
						id: entry.id,
						createdAt: entry.createdAt,
						expiresAt: entry.expiresAt,
						data: JSON.parse(plaintext) as Record<string, unknown>
					};
				})
			);

			const headers = [
				'id',
				'createdAt',
				'expiresAt',
				'date',
				'basalBodyTemp',
				'cervicalMucus',
				'lhSurge',
				'appetiteChange',
				'moodChange',
				'increasedSexDrive',
				'breastTenderness',
				'mildSpotting',
				'heightenedSmell',
				'cervixChanges',
				'fluidRetention',
				'cramping',
				'bleedingStart',
				'bleedingEnd',
				'bleedingFlow',
				'notes'
			];

			const rows = decrypted.map((entry) =>
				headers
					.map((h) => {
						let value: unknown;
						if (h === 'id' || h === 'createdAt' || h === 'expiresAt') {
							value = entry[h as keyof typeof entry];
						} else {
							value = entry.data[h];
						}
						if (value == null) return '';
						const str = String(value);
						if (str.includes(',') || str.includes('"') || str.includes('\n')) {
							return `"${str.replace(/"/g, '""')}"`;
						}
						return str;
					})
					.join(',')
			);

			const csv = [headers.join(','), ...rows].join('\n');
			downloadBlob(csv, 'text/csv', `lavender-export-${new Date().toISOString().slice(0, 10)}.csv`);
			flash((m) => (exportMsg = m), `Exported ${decrypted.length} entries as CSV.`, 'success');
		} catch (err) {
			flash((m) => (exportMsg = m), err instanceof Error ? err.message : 'Export failed.', 'error');
		}
	}

	function downloadBlob(content: string, mime: string, filename: string) {
		const blob = new Blob([content], { type: mime });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		a.click();
		URL.revokeObjectURL(url);
	}

	async function deleteAllData() {
		try {
			await metricsApi.deleteAll();
			await metricsStore.clearCache();
			entriesStore.clear();
			dataDeleted = true;
			confirmDeleteData = false;
		} catch (err) {
			alert(`Operation failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
		}
	}

	async function deleteAccount() {
		try {
			await authApi.deleteAccount();
			await metricsStore.clearCache();
			entriesStore.clear();
			auth.logout();
			goto('/auth/login', { replaceState: true });
		} catch (err) {
			alert(`Operation failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
		}
	}

	async function logout() {
		await metricsStore.clearCache();
		entriesStore.clear();
		auth.logout();
		goto('/auth/login', { replaceState: true });
	}
</script>

<svelte:head>
	<title>Settings — Lavender</title>
</svelte:head>

<div class="header">
	<Text as="h2">Settings</Text>
	<Button variant="outline" type="button" onclick={logout}>Log Out</Button>
</div>

<section class="card">
	<Text as="h3">Units</Text>
	<label for="unit-system">Measurement system</label>
	<select id="unit-system" bind:value={unitSystem}>
		<option value="metric">Metric (°C, kg, cm)</option>
		<option value="us">US (°F, lb, in)</option>
	</select>
	<Button type="button" onclick={saveUnits}>Save</Button>
	{#if unitsMsg}
		<div class="msg {unitsMsg.type}">{unitsMsg.text}</div>
	{/if}
</section>

<section class="card">
	<Text as="h3">Data Retention</Text>
	<label for="retention">Auto-delete entries older than</label>
	<select id="retention" bind:value={retentionDays}>
		<option value={180}>6 months</option>
		<option value={270}>9 months</option>
		<option value={365}>1 year</option>
	</select>
	<Button type="button" onclick={saveRetention}>Save</Button>
	{#if retentionMsg}
		<div class="msg {retentionMsg.type}">{retentionMsg.text}</div>
	{/if}
</section>

<section class="card">
	<Text as="h3">Export Data</Text>
	<p>Download all your health entries as a decrypted file for backup or analysis.</p>
	<div class="export-actions">
		<Button type="button" onclick={exportJson}>Export JSON</Button>
		<Button type="button" onclick={exportCsv}>Export CSV</Button>
	</div>
	{#if exportMsg}
		<div class="msg {exportMsg.type}">{exportMsg.text}</div>
	{/if}
</section>

<section class="card">
	<Text as="h3">Change Password</Text>
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
	{#if passwordMsg}
		<div class="msg {passwordMsg.type}">{passwordMsg.text}</div>
	{/if}
</section>

<section class="card danger">
	<Text as="h3">Danger Zone</Text>
	<div class="danger-actions">
		{#if !confirmDeleteData}
			<Button variant="danger-outline" type="button" onclick={() => (confirmDeleteData = true)}>
				Delete All Data
			</Button>
		{:else}
			<div class="confirm">
				<p>This will permanently delete all your health entries. This action cannot be undone.</p>
				<div class="confirm-actions">
					<Button variant="danger" type="button" onclick={deleteAllData}
						>Yes, Delete All Data</Button
					>
					<Button variant="outline" type="button" onclick={() => (confirmDeleteData = false)}
						>Cancel</Button
					>
				</div>
			</div>
		{/if}
		{#if dataDeleted}
			<p class="deleted">All data deleted.</p>
		{/if}

		{#if !confirmDeleteAccount}
			<Button variant="danger" type="button" onclick={() => (confirmDeleteAccount = true)}>
				Delete Account
			</Button>
		{:else}
			<div class="confirm">
				<p>
					This will permanently delete your account and all associated data. This cannot be undone.
				</p>
				<div class="confirm-actions">
					<Button variant="danger" type="button" onclick={deleteAccount}
						>Yes, Delete My Account</Button
					>
					<Button variant="outline" type="button" onclick={() => (confirmDeleteAccount = false)}
						>Cancel</Button
					>
				</div>
			</div>
		{/if}
	</div>
</section>

<style>
	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: var(--space-md);
	}

	.card {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		padding: var(--space-lg);
		box-shadow: var(--shadow-sm);
		margin-bottom: var(--space-lg);
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.card.danger {
		border-color: #fca5a5;
	}

	.card.danger :global(h3) {
		color: var(--color-error);
	}

	.danger-actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-sm);
	}

	label {
		font-size: var(--text-sm);
		font-weight: 500;
	}

	select {
		padding: 0.625rem 0.75rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-text);
		font-size: var(--text-base);
	}

	select:focus {
		outline: none;
		border-color: var(--color-border-focus);
		box-shadow: 0 0 0 3px var(--color-primary-alpha);
	}

	.requirements {
		font-size: var(--text-xs);
		color: var(--color-text-muted);
		padding-left: var(--space-md);
		list-style: disc;
	}

	.requirements li.met {
		color: var(--color-success);
	}

	.export-actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-sm);
	}

	.btn-primary,
	.btn-outline,
	.btn-danger,
	.btn-danger-outline {
		align-self: flex-start;
	}

	.confirm {
		background: var(--color-error-bg);
		padding: var(--space-md);
		border-radius: var(--radius-md);
	}

	.confirm-actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-sm);
		margin-top: var(--space-sm);
	}

	.deleted {
		color: var(--color-success);
		font-size: var(--text-sm);
	}

	.msg {
		padding: var(--space-sm) var(--space-md);
		border-radius: var(--radius-md);
		font-size: var(--text-sm);
	}

	.msg.success {
		background: var(--color-success-bg);
		color: var(--color-success);
	}

	.msg.error {
		background: var(--color-error-bg);
		color: var(--color-error);
	}
</style>
