<script lang="ts">
	import { metricsApi } from '$lib/client/api';
	import { decrypt, getStoredKey, importKey } from '$lib/client/crypto';
	import Button from './Button.svelte';
	import FlashMessage from './FlashMessage.svelte';
	import SettingsCard from './SettingsCard.svelte';

	let msg = $state<{ text: string; type: 'success' | 'error' } | null>(null);

	function flash(text: string, type: 'success' | 'error') {
		msg = { text, type };
		setTimeout(() => (msg = null), 4000);
	}

	async function decryptAll() {
		const storedKey = getStoredKey();
		if (!storedKey) throw new Error('Encryption key not found. Please log in again.');
		const entries = await metricsApi.getAll();
		const key = await importKey(storedKey);
		return Promise.all(
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

	async function exportJson() {
		try {
			const decrypted = await decryptAll();
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
			flash(`Exported ${decrypted.length} entries.`, 'success');
		} catch (err) {
			flash(err instanceof Error ? err.message : 'Export failed.', 'error');
		}
	}

	const csvHeaders = [
		'id', 'createdAt', 'expiresAt', 'date', 'basalBodyTemp', 'cervicalMucus',
		'lhSurge', 'appetiteChange', 'moodChange', 'increasedSexDrive',
		'breastTenderness', 'mildSpotting', 'heightenedSmell', 'cervixChanges',
		'fluidRetention', 'cramping', 'bleedingStart', 'bleedingEnd', 'bleedingFlow', 'notes'
	];

	function escapeCsv(value: unknown): string {
		if (value == null) return '';
		const str = String(value);
		if (str.includes(',') || str.includes('"') || str.includes('\n')) {
			return `"${str.replace(/"/g, '""')}"`;
		}
		return str;
	}

	async function exportCsv() {
		try {
			const decrypted = await decryptAll();
			const rows = decrypted.map((entry) =>
				csvHeaders
					.map((h) => {
						const value =
							h === 'id' || h === 'createdAt' || h === 'expiresAt'
								? entry[h as keyof typeof entry]
								: entry.data[h];
						return escapeCsv(value);
					})
					.join(',')
			);
			const csv = [csvHeaders.join(','), ...rows].join('\n');
			downloadBlob(csv, 'text/csv', `lavender-export-${new Date().toISOString().slice(0, 10)}.csv`);
			flash(`Exported ${decrypted.length} entries as CSV.`, 'success');
		} catch (err) {
			flash(err instanceof Error ? err.message : 'Export failed.', 'error');
		}
	}

	const symptomLabels: [string, string][] = [
		['appetiteChange', 'Appetite change'],
		['moodChange', 'Mood change'],
		['increasedSexDrive', 'Increased sex drive'],
		['breastTenderness', 'Breast tenderness'],
		['mildSpotting', 'Mild spotting'],
		['heightenedSmell', 'Heightened smell'],
		['cervixChanges', 'Cervix changes'],
		['fluidRetention', 'Fluid retention'],
		['cramping', 'Cramping']
	];

	async function exportPdf() {
		try {
			const decrypted = await decryptAll();
			decrypted.sort(
				(a, b) =>
					new Date(b.data.date as string).getTime() - new Date(a.data.date as string).getTime()
			);

			const printWindow = window.open('', '_blank');
			if (!printWindow) {
				flash('Pop-up blocked. Please allow pop-ups and try again.', 'error');
				return;
			}

			const doc = printWindow.document;
			doc.title = 'Lavender — Cycle Report';

			const style = doc.createElement('style');
			style.textContent = `
				body { font-family: system-ui, sans-serif; padding: 2rem; color: #1e1e2e; }
				h1 { font-size: 1.4rem; margin-bottom: 0.25rem; }
				.meta { font-size: 0.85rem; color: #666; margin-bottom: 1rem; }
				table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
				th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
				th { background: #f4f0fa; }
				@media print { body { padding: 0; } }
			`;
			doc.head.appendChild(style);

			const h1 = doc.createElement('h1');
			h1.textContent = 'Lavender — Cycle Report';
			doc.body.appendChild(h1);

			const meta = doc.createElement('p');
			meta.className = 'meta';
			meta.textContent = `Generated ${new Date().toLocaleDateString()} · ${decrypted.length} entries`;
			doc.body.appendChild(meta);

			const table = doc.createElement('table');
			const thead = table.createTHead();
			const headerRow = thead.insertRow();
			for (const label of ['Date', 'BBT', 'Cervical Mucus', 'LH Surge', 'Bleeding', 'Symptoms', 'Notes']) {
				const th = doc.createElement('th');
				th.textContent = label;
				headerRow.appendChild(th);
			}

			const tbody = table.createTBody();
			for (const entry of decrypted) {
				const d = entry.data;
				const symptoms = symptomLabels
					.filter(([key]) => d[key])
					.map(([, label]) => label)
					.join(', ');

				const row = tbody.insertRow();
				for (const val of [
					d.date ?? '',
					d.basalBodyTemp ?? '',
					d.cervicalMucus ?? '',
					d.lhSurge ? 'Yes' : '',
					d.bleedingFlow ?? '',
					symptoms || '—',
					d.notes ?? ''
				]) {
					const td = row.insertCell();
					td.textContent = String(val);
				}
			}

			doc.body.appendChild(table);
			printWindow.addEventListener('afterprint', () => printWindow.close());
			printWindow.print();
			flash(`PDF report ready (${decrypted.length} entries).`, 'success');
		} catch (err) {
			flash(err instanceof Error ? err.message : 'Export failed.', 'error');
		}
	}
</script>

<SettingsCard title="Export Data">
	<p>Download all your health entries as a decrypted file for backup or analysis.</p>
	<div class="export-actions">
		<Button type="button" onclick={exportJson}>Export JSON</Button>
		<Button type="button" onclick={exportCsv}>Export CSV</Button>
		<Button type="button" onclick={exportPdf}>Export PDF</Button>
	</div>
	<FlashMessage message={msg} />
</SettingsCard>

<style>
	.export-actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-sm);
	}
</style>
