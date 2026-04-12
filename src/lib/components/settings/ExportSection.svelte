<script lang="ts">
	import { PDF, StandardFonts, rgb } from '@libpdf/core';
	import Chart from 'chart.js/auto';
	import { decrypt, getStoredKey, importKey } from '$lib/client/crypto';
	import { metricsStore } from '$lib/services/metrics-store';
	import { getCycleSegments, toFertilityEntry } from '$lib/utils/fertility';
	import { celsiusToFahrenheit, getUnitSystem } from '$lib/utils/units';
	import { _ } from 'svelte-i18n';
	import Button from '$lib/components/ui/Button.svelte';
	import FlashMessage from '$lib/components/display/FlashMessage.svelte';
	import SettingsCard from '$lib/components/layout/SettingsCard.svelte';

	let msg = $state<{ text: string; type: 'success' | 'error' } | null>(null);

	function flash(text: string, type: 'success' | 'error') {
		msg = { text, type };
		setTimeout(() => (msg = null), 4000);
	}

	async function decryptAll() {
		const storedKey = getStoredKey();
		if (!storedKey) throw new Error($_('settings.import.keyNotFound'));
		const entries = await metricsStore.getAll();
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
			flash(
				$_('settings.export.exportedEntries', { values: { count: decrypted.length } }),
				'success'
			);
		} catch (err) {
			flash(err instanceof Error ? err.message : $_('settings.export.exportFailed'), 'error');
		}
	}

	const csvHeaders = [
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
		'intimacy',
		'notes'
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
			flash($_('settings.export.exportedCsv', { values: { count: decrypted.length } }), 'success');
		} catch (err) {
			flash(err instanceof Error ? err.message : $_('settings.export.exportFailed'), 'error');
		}
	}

	const symptomKeys = [
		'appetiteChange',
		'moodChange',
		'increasedSexDrive',
		'breastTenderness',
		'mildSpotting',
		'heightenedSmell',
		'cervixChanges',
		'fluidRetention',
		'cramping'
	] as const;

	async function exportPdf() {
		try {
			const decrypted = await decryptAll();
			const fertilityEntries = decrypted.map((e) => toFertilityEntry(e.data as any));
			const segments = getCycleSegments(fertilityEntries);

			const pdf = PDF.create();
			const margin = 50;
			const headerFont = StandardFonts.HelveticaBold;
			const bodyFont = StandardFonts.Helvetica;
			const headerSize = 8;
			const bodySize = 7;
			const rowHeight = 16;

			const columns: { label: string; x: number; width: number }[] = [
				{ label: $_('settings.export.pdfColumns.date'), x: margin, width: 62 },
				{ label: $_('settings.export.pdfColumns.bbt'), x: 112, width: 36 },
				{ label: $_('settings.export.pdfColumns.mucus'), x: 148, width: 52 },
				{ label: $_('settings.export.pdfColumns.lh'), x: 200, width: 26 },
				{ label: $_('settings.export.pdfColumns.bleeding'), x: 226, width: 48 },
				{ label: $_('settings.export.pdfColumns.symptoms'), x: 274, width: 200 },
				{ label: $_('settings.export.pdfColumns.notes'), x: 474, width: 88 }
			];
			const tableWidth = columns[columns.length - 1].x + columns[columns.length - 1].width - margin;

			const black = rgb(0, 0, 0);
			const gray = rgb(0.4, 0.4, 0.4);
			const headerBg = rgb(0.96, 0.94, 0.98);
			const lineColor = rgb(0.8, 0.8, 0.8);

			function truncate(text: string, maxChars: number): string {
				return text.length > maxChars ? `${text.slice(0, maxChars - 1)}…` : text;
			}

			let page = pdf.addPage({ size: 'letter' });
			let y = page.height - margin;

			page.drawText($_('settings.export.pdfTitle'), {
				x: margin,
				y,
				font: headerFont,
				size: 16,
				color: black
			});
			y -= 16;
			page.drawText(
				$_('settings.export.pdfGenerated', {
					values: { date: new Date().toLocaleDateString(), count: decrypted.length }
				}),
				{ x: margin, y, font: bodyFont, size: 9, color: gray }
			);
			y -= 24;

			function drawTableHeader() {
				page.drawRectangle({
					x: margin,
					y: y - rowHeight + 4,
					width: tableWidth,
					height: rowHeight,
					color: headerBg
				});
				for (const col of columns) {
					page.drawText(col.label, {
						x: col.x + 3,
						y: y - 8,
						font: headerFont,
						size: headerSize,
						color: black
					});
				}
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
				if (y - rowHeight < margin) {
					page = pdf.addPage({ size: 'letter' });
					y = page.height - margin;
					drawTableHeader();
				}

				const d = entry.data;
				const symptoms = symptomKeys
					.filter((key) => d[key])
					.map((key) => $_(`settings.export.symptoms.${key}`))
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

				page.drawLine({
					start: { x: margin, y: y - rowHeight + 4 },
					end: { x: margin + tableWidth, y: y - rowHeight + 4 },
					color: lineColor,
					thickness: 0.25
				});

				y -= rowHeight;
			}

			// Add temperature chart page
			page = pdf.addPage({ size: 'letter' });
			y = page.height - margin;
			page.drawText('Temperature Chart', {
				x: margin,
				y,
				font: headerFont,
				size: 16,
				color: black
			});
			y -= 24;

			const bbtEntries = decrypted.filter((e) => e.data.basalBodyTemp != null);
			if (bbtEntries.length > 0) {
				const isUS = getUnitSystem() === 'us';
				const tempUnit = isUS ? '°F' : '°C';
				const canvas = document.createElement('canvas');
				canvas.width = 500;
				canvas.height = 400;
				const ctx = canvas.getContext('2d');
				if (ctx) {
					const chart = new Chart(ctx, {
						type: 'line',
						data: {
							labels: bbtEntries.map((e) => e.data.date as string),
							datasets: [
								{
									label: `Basal Body Temperature (${tempUnit})`,
									data: bbtEntries.map((e) =>
										isUS ? celsiusToFahrenheit(e.data.basalBodyTemp as number) : (e.data.basalBodyTemp as number)
									),
									borderColor: 'rgb(75, 192, 192)',
									backgroundColor: 'rgba(75, 192, 192, 0.2)',
									tension: 0.1
								}
							]
						},
						options: {
							responsive: false,
							scales: {
								x: {
									title: { display: true, text: 'Date' }
								},
								y: {
									title: { display: true, text: `Temperature (${tempUnit})` }
								}
							}
						}
					});
					// Wait for chart to render
					await new Promise((resolve) => setTimeout(resolve, 100));
					const base64 = chart.toBase64Image();
					const imageBytes = Uint8Array.from(atob(base64.split(',')[1]), (c) => c.charCodeAt(0));
					const pngImage = await pdf.embedPng(imageBytes);
					page.drawImage(pngImage, {
						x: margin,
						y: y - 400,
						width: 500,
						height: 400
					});
					chart.destroy();
				}
			}

			// Add comparison chart page
			if (segments.length >= 2) {
				page = pdf.addPage({ size: 'letter' });
				y = page.height - margin;
				page.drawText('Cycle Temperature Comparison', {
					x: margin,
					y,
					font: headerFont,
					size: 16,
					color: black
				});
				y -= 24;

				const recentSegments = segments.slice(-5);
				const isUS = getUnitSystem() === 'us';
				const tempUnit = isUS ? '°F' : '°C';
				const CYCLE_COLORS = ['#7c3aed', '#ec4899', '#10b981', '#f59e0b', '#3b82f6', '#ef4444'];
				const MIN_OFFSET = -20;
				const MAX_OFFSET = 20;
				const offsetRange: number[] = [];
				for (let d = MIN_OFFSET; d <= MAX_OFFSET; d++) offsetRange.push(d);

				const datasets = recentSegments.map((segment, idx) => {
					const offsetMap = new Map<number, number>();
					for (const entry of segment.entries) {
						if (entry.bbt !== undefined) {
							offsetMap.set(
								entry.dayOffset,
								isUS ? celsiusToFahrenheit(entry.bbt) : entry.bbt
							);
						}
					}
					return {
						label: `Cycle ${segment.index + 1}`,
						data: offsetRange.map((d) => offsetMap.get(d) ?? null),
						borderColor: CYCLE_COLORS[idx % CYCLE_COLORS.length],
						backgroundColor: 'transparent',
						pointRadius: offsetRange.map((d) => (offsetMap.has(d) ? 3 : 0)),
						tension: 0.3,
						spanGaps: true
					};
				});

				const canvas2 = document.createElement('canvas');
				canvas2.width = 500;
				canvas2.height = 400;
				const ctx2 = canvas2.getContext('2d');
				if (ctx2) {
					const chart2 = new Chart(ctx2, {
						type: 'line',
						data: {
							labels: offsetRange.map((d) =>
								d === 0 ? 'Ovulation' : d > 0 ? `+${d}` : String(d)
							),
							datasets
						},
						options: {
							responsive: false,
							scales: {
								x: {
									title: { display: true, text: 'Days from Ovulation' }
								},
								y: {
									title: { display: true, text: `Temperature (${tempUnit})` }
								}
							}
						}
					});
					await new Promise((resolve) => setTimeout(resolve, 100));
					const base64_2 = chart2.toBase64Image();
					const imageBytes2 = Uint8Array.from(atob(base64_2.split(',')[1]), (c) =>
						c.charCodeAt(0)
					);
					const pngImage2 = await pdf.embedPng(imageBytes2);
					page.drawImage(pngImage2, {
						x: margin,
						y: y - 400,
						width: 500,
						height: 400
					});
					chart2.destroy();
				}
			}

			const bytes = await pdf.save();
			downloadFile(
				bytes,
				'application/pdf',
				`lavender-report-${new Date().toISOString().slice(0, 10)}.pdf`
			);
			flash($_('settings.export.exportedPdf', { values: { count: decrypted.length } }), 'success');
		} catch (err) {
			flash(err instanceof Error ? err.message : $_('settings.export.exportFailed'), 'error');
		}
	}
</script>

<SettingsCard title={$_('settings.export.title')}>
	<p>{$_('settings.export.description')}</p>
	<p>{$_('settings.export.pdfDescription')}</p>
	<div class="export-actions">
		<Button type="button" onclick={exportJson}>{$_('settings.export.json')}</Button>
		<Button type="button" onclick={exportCsv}>{$_('settings.export.csv')}</Button>
		<Button type="button" onclick={exportPdf}>{$_('settings.export.pdf')}</Button>
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
