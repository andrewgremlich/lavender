<script lang="ts">
	import { PDF, rgb, StandardFonts } from '@libpdf/core';
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

	function downloadFile(content: string | Uint8Array, mime: string, filename: string) {
		const blob =
			content instanceof Uint8Array
				? new Blob([new Uint8Array(content).buffer], { type: mime })
				: new Blob([content], { type: mime });
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
			downloadFile(
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
			downloadFile(csv, 'text/csv', `lavender-export-${new Date().toISOString().slice(0, 10)}.csv`);
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

			const pdf = PDF.create();
			const margin = 50;
			const headerFont = StandardFonts.HelveticaBold;
			const bodyFont = StandardFonts.Helvetica;
			const headerSize = 8;
			const bodySize = 7;
			const rowHeight = 16;

			const columns: { label: string; x: number; width: number }[] = [
				{ label: 'Date', x: margin, width: 62 },
				{ label: 'BBT', x: 112, width: 36 },
				{ label: 'Mucus', x: 148, width: 52 },
				{ label: 'LH', x: 200, width: 26 },
				{ label: 'Bleeding', x: 226, width: 48 },
				{ label: 'Symptoms', x: 274, width: 200 },
				{ label: 'Notes', x: 474, width: 88 }
			];
			const tableWidth = columns[columns.length - 1].x + columns[columns.length - 1].width - margin;

			const black = rgb(0, 0, 0);
			const gray = rgb(0.4, 0.4, 0.4);
			const headerBg = rgb(0.96, 0.94, 0.98);
			const lineColor = rgb(0.8, 0.8, 0.8);

			function truncate(text: string, maxChars: number): string {
				return text.length > maxChars ? text.slice(0, maxChars - 1) + '…' : text;
			}

			let page = pdf.addPage({ size: 'letter' });
			let y = page.height - margin;

			// Title
			page.drawText('Lavender — Cycle Report', {
				x: margin,
				y,
				font: headerFont,
				size: 16,
				color: black
			});
			y -= 16;
			page.drawText(
				`Generated ${new Date().toLocaleDateString()} · ${decrypted.length} entries`,
				{ x: margin, y, font: bodyFont, size: 9, color: gray }
			);
			y -= 24;

			function drawTableHeader() {
				// Header background
				page.drawRectangle({
					x: margin,
					y: y - rowHeight + 4,
					width: tableWidth,
					height: rowHeight,
					color: headerBg
				});
				// Header text
				for (const col of columns) {
					page.drawText(col.label, {
						x: col.x + 3,
						y: y - 8,
						font: headerFont,
						size: headerSize,
						color: black
					});
				}
				// Header bottom line
				page.drawLine({
					start: { x: margin, y: y - rowHeight + 4 },
					end: { x: margin + tableWidth, y: y - rowHeight + 4 },
					color: black,
					thickness: 0.5
				});
				y -= rowHeight;
			}

			drawTableHeader();

			for (const entry of decrypted) {
				// New page if we're running out of space
				if (y - rowHeight < margin) {
					page = pdf.addPage({ size: 'letter' });
					y = page.height - margin;
					drawTableHeader();
				}

				const d = entry.data;
				const symptoms = symptomLabels
					.filter(([key]) => d[key])
					.map(([, label]) => label)
					.join(', ');

				const values = [
					String(d.date ?? ''),
					String(d.basalBodyTemp ?? ''),
					String(d.cervicalMucus ?? ''),
					d.lhSurge ? 'Yes' : '',
					String(d.bleedingFlow ?? ''),
					symptoms || '—',
					String(d.notes ?? '')
				];

				for (let i = 0; i < columns.length; i++) {
					const maxChars = Math.floor(columns[i].width / 4);
					page.drawText(truncate(values[i], maxChars), {
						x: columns[i].x + 3,
						y: y - 8,
						font: bodyFont,
						size: bodySize,
						color: black
					});
				}

				// Row separator
				page.drawLine({
					start: { x: margin, y: y - rowHeight + 4 },
					end: { x: margin + tableWidth, y: y - rowHeight + 4 },
					color: lineColor,
					thickness: 0.25
				});

				y -= rowHeight;
			}

			const bytes = await pdf.save();
			downloadFile(
				bytes,
				'application/pdf',
				`lavender-report-${new Date().toISOString().slice(0, 10)}.pdf`
			);
			flash(`Exported ${decrypted.length} entries as PDF.`, 'success');
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
