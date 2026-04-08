<script lang="ts">
	import { metricsApi } from '$lib/client/api';
	import { encrypt, getStoredKey, importKey } from '$lib/client/crypto';
	import { entriesStore } from '$lib/client/entries.svelte';
	import { metricsStore } from '$lib/services/metrics-store';
	import { _ } from 'svelte-i18n';
	import Button from './Button.svelte';
	import FlashMessage from './FlashMessage.svelte';
	import SettingsCard from './SettingsCard.svelte';

	let msg = $state<{ text: string; type: 'success' | 'error' } | null>(null);
	let importing = $state(false);
	let fileInput = $state<HTMLInputElement | null>(null);
	let fileName = $state('');

	function flash(text: string, type: 'success' | 'error') {
		msg = { text, type };
		setTimeout(() => (msg = null), 4000);
	}

	function parseCsvRow(line: string): string[] {
		const fields: string[] = [];
		let current = '';
		let inQuotes = false;
		for (let i = 0; i < line.length; i++) {
			const ch = line[i];
			if (inQuotes) {
				if (ch === '"' && line[i + 1] === '"') {
					current += '"';
					i++;
				} else if (ch === '"') {
					inQuotes = false;
				} else {
					current += ch;
				}
			} else if (ch === '"') {
				inQuotes = true;
			} else if (ch === ',') {
				fields.push(current);
				current = '';
			} else {
				current += ch;
			}
		}
		fields.push(current);
		return fields;
	}

	const booleanFields = new Set([
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
		'bleedingEnd'
	]);

	const skipFields = new Set(['id', 'createdAt', 'expiresAt']);

	function csvToEntries(text: string): Record<string, unknown>[] {
		const lines = text.split(/\r?\n/).filter((l) => l.trim());
		if (lines.length < 2) return [];
		const headers = parseCsvRow(lines[0]);
		return lines.slice(1).map((line) => {
			const values = parseCsvRow(line);
			const obj: Record<string, unknown> = {};
			headers.forEach((h, i) => {
				const v = values[i] ?? '';
				if (v === '' || skipFields.has(h)) return;
				if (h === 'lhSurge') {
					obj[h] = Number(v);
				} else if (booleanFields.has(h)) {
					obj[h] = v === 'true' || v === '1';
				} else if (h === 'basalBodyTemp') {
					obj[h] = parseFloat(v);
				} else {
					obj[h] = v;
				}
			});
			return obj;
		});
	}

	function parseJsonEntries(text: string): Record<string, unknown>[] {
		const parsed = JSON.parse(text);
		const arr = Array.isArray(parsed) ? parsed : parsed.entries;
		if (!Array.isArray(arr)) throw new Error($_('settings.import.invalidJsonFormat'));
		return arr.map((e: Record<string, unknown>) => {
			if (e.data && typeof e.data === 'object') return e.data as Record<string, unknown>;
			const rest = { ...e };
			delete rest.id;
			delete rest.createdAt;
			delete rest.expiresAt;
			return rest;
		});
	}

	async function handleImport() {
		const file = fileInput?.files?.[0];
		if (!file) {
			flash($_('settings.import.selectFileError'), 'error');
			return;
		}

		const storedKey = getStoredKey();
		if (!storedKey) {
			flash($_('settings.import.keyNotFound'), 'error');
			return;
		}

		importing = true;
		try {
			const text = await file.text();
			const key = await importKey(storedKey);

			let entries: Record<string, unknown>[];
			if (file.name.endsWith('.json')) {
				entries = parseJsonEntries(text);
			} else if (file.name.endsWith('.csv')) {
				entries = csvToEntries(text);
			} else {
				throw new Error($_('settings.import.unsupportedFileType'));
			}

			entries = entries.filter((e) => e.date);
			if (entries.length === 0) {
				flash($_('settings.import.noValidEntries'), 'error');
				return;
			}

			let imported = 0;
			for (const entry of entries) {
				const { encrypted, iv } = await encrypt(JSON.stringify(entry), key);
				await metricsApi.create(encrypted, iv);
				imported++;
			}

			await metricsStore.clearCache();
			entriesStore.clear();
			flash($_('settings.import.importedEntries', { values: { count: imported } }), 'success');
		} catch (err) {
			flash(err instanceof Error ? err.message : $_('settings.import.importFailed'), 'error');
		} finally {
			importing = false;
			if (fileInput) fileInput.value = '';
			fileName = '';
		}
	}
</script>

<SettingsCard title={$_('settings.import.title')}>
	<p>{$_('settings.import.description')}</p>
	<div class="file-picker">
		<input
			type="file"
			accept=".json,.csv"
			bind:this={fileInput}
			onchange={() => (fileName = fileInput?.files?.[0]?.name ?? '')}
			class="file-input-hidden"
			id="import-file"
			aria-label={$_('settings.import.fileAriaLabel')}
		/>
		<label for="import-file" class="file-label">
			{$_('settings.import.chooseFile')}
		</label>
		<span class="file-name">{fileName || $_('settings.import.noFileSelected')}</span>
	</div>
	<Button type="button" onclick={handleImport} disabled={importing}>
		{importing ? $_('settings.import.importing') : $_('settings.import.import')}
	</Button>
	<FlashMessage message={msg} />
</SettingsCard>

<style>
	.file-input-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	.file-picker {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
	}

	.file-label {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.625rem 1.25rem;
		font-family: inherit;
		font-size: var(--text-sm);
		font-weight: 500;
		color: var(--color-primary);
		background: transparent;
		border: 1px solid var(--color-primary);
		border-radius: var(--radius-md);
		cursor: pointer;
		transition: all var(--transition-fast);
		white-space: nowrap;
	}

	.file-label:hover {
		background: var(--color-primary-alpha);
	}

	.file-input-hidden:focus-visible + .file-label {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.file-name {
		font-size: var(--text-sm);
		color: var(--color-text-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 200px;
	}
</style>
