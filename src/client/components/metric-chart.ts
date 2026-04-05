import type { HealthEntryData } from "@shared/types";
import type { TooltipItem } from "chart.js";
import Chart from "chart.js/auto";

import {
	clearLegacyKey,
	decrypt,
	encrypt,
	getLegacyKey,
	getStoredKey,
	importKey,
} from "../crypto/encryption";
import { navigate } from "../router";
import { api } from "../services/api";
import { metricsStore } from "../services/metrics-store";
import { refreshFromServer } from "../services/sync-engine";
import {
	calculateFertilityIndicators,
	type FertilityIndicators,
	toFertilityEntry,
} from "../utils/fertility";
import {
	countIndicators,
	getActiveIndicatorLabels,
	INDICATORS,
} from "../utils/indicators";
import { celsiusToFahrenheit, getUnitSystem } from "../utils/units";
import type { CycleCalendar } from "./cycle-calendar";

type HealthEntry = HealthEntryData & { id: string };
type DateRange = "30" | "90" | "180" | "365" | "all";

const LH_LABELS: Record<number, string> = {
	0: "None",
	1: "Light",
	2: "Positive",
};

function normalizeLhSurge(value: unknown): 0 | 1 | 2 {
	if (value === true) return 2;
	if (typeof value === "number" && (value === 0 || value === 1 || value === 2))
		return value;
	return 0;
}

const MUCUS_LABELS: Record<string, string> = {
	dry: "Dry",
	sticky: "Sticky",
	creamy: "Creamy",
	watery: "Watery",
	eggWhite: "Egg White",
};

class MetricChart extends HTMLElement {
	private shadow: ShadowRoot;
	private chart: Chart | null = null;
	private entries: HealthEntry[] = [];
	private fertility: FertilityIndicators = {
		ovulationDays: new Set(),
		fertileWindowDays: new Set(),
		cmFertileDays: new Set(),
		periodDays: new Set(),
		predictedPeriodDays: new Set(),
		predictedOvulationDays: new Set(),
		predictedFertileDays: new Set(),
		averageCycleLength: null,
		cycleVariability: null,
	};
	private selectedRange: DateRange = "30";

	constructor() {
		super();
		this.shadow = this.attachShadow({ mode: "open" });
	}

	connectedCallback() {
		this.render();
		this.loadData();
		window.addEventListener("sync-complete", this._onSyncComplete);
	}

	disconnectedCallback() {
		if (this.chart) {
			this.chart.destroy();
			this.chart = null;
		}
		window.removeEventListener("sync-complete", this._onSyncComplete);
	}

	private _onSyncComplete = () => {
		this.loadData();
	};

	private render() {
		this.shadow.innerHTML = `
      <link rel="stylesheet" href="/styles/main.css">
      <link rel="stylesheet" href="/styles/metric-chart.css">
      <h2>Dashboard</h2>
      <div id="main-content">
        <div class="loading" id="loading">Loading your data...</div>
      </div>
    `;
	}

	private async loadData() {
		const content = this.shadow.querySelector("#main-content") as HTMLElement;

		try {
			const storedKey = getStoredKey();
			if (!storedKey) {
				content.innerHTML =
					'<div class="error-msg">Encryption key not found. Please log in again.</div>';
				return;
			}

			const cryptoKey = await importKey(storedKey);

			// Step 1: Render from IDB immediately (offline-first)
			const cachedEntries = await metricsStore.getAll();
			if (cachedEntries.length > 0) {
				await this.decryptAndRender(cachedEntries, cryptoKey, content);
			}

			// Step 2: Sync from server in background (server is authoritative)
			const serverEntries = await refreshFromServer();

			// Re-render only if server data differs from cache
			const cacheIds = cachedEntries
				.map((e) => e.id)
				.sort()
				.join(",");
			const serverIds = serverEntries
				.map((e) => e.id)
				.sort()
				.join(",");
			if (cacheIds !== serverIds || cachedEntries.length === 0) {
				await this.decryptAndRender(serverEntries, cryptoKey, content);
			}
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : "Unknown error";
			content.innerHTML = `<div class="error-msg">Failed to load data: ${message}</div>`;
		}
	}

	private async decryptAndRender(
		rawEntries: { id: string; encryptedData: string; iv: string }[],
		cryptoKey: CryptoKey,
		content: HTMLElement,
	) {
		if (rawEntries.length === 0) {
			this.renderEmpty(content);
			return;
		}

		const legacyKeyBase64 = getLegacyKey();
		const legacyCryptoKey = legacyKeyBase64
			? await importKey(legacyKeyBase64)
			: null;

		const decryptedEntries: HealthEntry[] = [];
		for (const raw of rawEntries) {
			try {
				const decrypted = await decrypt(raw.encryptedData, raw.iv, cryptoKey);
				const parsed = JSON.parse(decrypted) as HealthEntryData;
				decryptedEntries.push({ ...parsed, id: raw.id });
			} catch {
				if (!legacyCryptoKey) continue;
				try {
					const decrypted = await decrypt(
						raw.encryptedData,
						raw.iv,
						legacyCryptoKey,
					);
					const parsed = JSON.parse(decrypted) as HealthEntryData;
					decryptedEntries.push({ ...parsed, id: raw.id });

					// Re-encrypt with current key and update server
					const { encrypted, iv } = await encrypt(decrypted, cryptoKey);
					await api.metrics.update(raw.id, encrypted, iv);
					console.log(`Migrated entry ${raw.id} to current key`);
				} catch (legacyErr) {
					console.error("Decryption failed for entry", raw.id, legacyErr);
				}
			}
		}

		if (legacyKeyBase64) {
			clearLegacyKey();
		}

		decryptedEntries.sort((a, b) => a.date.localeCompare(b.date));
		this.entries = decryptedEntries;
		this.fertility = calculateFertilityIndicators(
			decryptedEntries.map(toFertilityEntry),
		);

		this.renderDashboard(content);
	}

	private renderEmpty(container: HTMLElement) {
		container.innerHTML = `
      <div class="empty-state">
        <h3>No Data Yet</h3>
        <p>Start tracking your health metrics to see trends and insights.</p>
        <a id="add-data-link">Add Your First Entry</a>
      </div>
    `;
		container.querySelector("#add-data-link")?.addEventListener("click", () => {
			navigate("/entry");
		});
	}

	private renderDashboard(container: HTMLElement) {
		container.innerHTML = `
      <div class="range-selector">
        <button class="range-btn ${this.selectedRange === "30" ? "active" : ""}" data-range="30">30 Days</button>
        <button class="range-btn ${this.selectedRange === "90" ? "active" : ""}" data-range="90">3 Months</button>
        <button class="range-btn ${this.selectedRange === "180" ? "active" : ""}" data-range="180">6 Months</button>
        <button class="range-btn ${this.selectedRange === "365" ? "active" : ""}" data-range="365">1 Year</button>
        <button class="range-btn ${this.selectedRange === "all" ? "active" : ""}" data-range="all">All</button>
      </div>
      <div class="chart-card">
        <div class="chart-container">
          <canvas id="bbt-chart"></canvas>
        </div>
        <div class="legend-section">
          <div class="legend-item"><span class="legend-dot" style="background:#7c3aed"></span> BBT</div>
          <div class="legend-item"><span class="legend-dot" style="background:rgba(245,158,11,0.5);border-radius:2px"></span> LH Surge</div>
          <div class="legend-item"><span class="legend-dot" style="background:#ec4899"></span> Ovulation</div>
          <div class="legend-item"><span class="legend-dot" style="background:#10b981;opacity:0.3"></span> Fertile Window</div>
          <div class="legend-item"><span class="legend-dot" style="background:rgba(244,114,182,0.5);border-radius:2px"></span> Indicators</div>
        </div>
      </div>
      <div class="calendar-section">
        <cycle-calendar id="cycle-calendar"></cycle-calendar>
      </div>
      <div class="summary-section">
        <h3>Recent Entries</h3>
        <div class="entry-list" id="entry-list"></div>
      </div>
    `;

		// Range selector
		this.shadow.querySelectorAll(".range-btn").forEach((btn) => {
			btn.addEventListener("click", () => {
				this.selectedRange = (btn as HTMLElement).dataset.range as DateRange;
				this.renderDashboard(container);
			});
		});

		const filtered = this.getFilteredEntries();
		this.renderChart(filtered);
		this.renderRecentEntries(filtered);

		const calendarEl = this.shadow.querySelector(
			"#cycle-calendar",
		) as CycleCalendar | null;
		if (calendarEl) {
			calendarEl.setData({
				fertility: this.fertility,
				currentMonth: new Date(),
			});
		}
	}

	private getFilteredEntries(): HealthEntry[] {
		if (this.selectedRange === "all") return this.entries;

		const days = Number.parseInt(this.selectedRange, 10);
		const cutoff = new Date();
		cutoff.setDate(cutoff.getDate() - days);
		const cutoffStr = cutoff.toISOString().split("T")[0];

		return this.entries.filter((e) => e.date >= cutoffStr);
	}

	private renderChart(entries: HealthEntry[]) {
		const canvas = this.shadow.querySelector("#bbt-chart") as HTMLCanvasElement;
		if (!canvas) return;

		if (this.chart) {
			this.chart.destroy();
			this.chart = null;
		}

		const isUS = getUnitSystem() === "us";
		const tempUnit = isUS ? "\u00b0F" : "\u00b0C";
		const bbtEntries = entries.filter((e) => e.basalBodyTemp != null);
		const labels = bbtEntries.map((e) => e.date);
		const temps = bbtEntries.map((e) =>
			isUS ? celsiusToFahrenheit(e.basalBodyTemp ?? 0) : (e.basalBodyTemp ?? 0),
		);

		// Create point colors based on computed fertility indicators
		const { ovulationDays, fertileWindowDays } = this.fertility;
		const pointBorderColors = bbtEntries.map((e) => {
			if (ovulationDays.has(e.date)) return "#ec4899";
			if (normalizeLhSurge(e.lhSurge) >= 1) return "#f59e0b";
			return "#7c3aed";
		});
		const pointRadius = bbtEntries.map((e) => {
			if (ovulationDays.has(e.date) || normalizeLhSurge(e.lhSurge) >= 1)
				return 6;
			return 3;
		});
		const pointBgColors = bbtEntries.map((e) => {
			if (ovulationDays.has(e.date)) return "#ec4899";
			if (normalizeLhSurge(e.lhSurge) >= 1) return "#f59e0b";
			if (fertileWindowDays.has(e.date)) return "rgba(16, 185, 129, 0.4)";
			return "#7c3aed";
		});

		// Build LH surge data aligned to the same labels
		const lhSurgeData = bbtEntries.map((e) => normalizeLhSurge(e.lhSurge));

		// Build indicator count data aligned to the same labels
		const indicatorCounts = bbtEntries.map((e) =>
			countIndicators(e as unknown as Record<string, unknown>),
		);
		const maxIndicators = INDICATORS.length;

		this.chart = new Chart(canvas, {
			data: {
				labels,
				datasets: [
					{
						type: "bar" as const,
						label: "LH Surge",
						data: lhSurgeData,
						backgroundColor: "rgba(245, 158, 11, 0.5)",
						borderColor: "rgba(245, 158, 11, 0.8)",
						borderWidth: 1,
						yAxisID: "yIndicators",
						order: 3,
					},
					{
						type: "bar" as const,
						label: "Indicators",
						data: indicatorCounts,
						backgroundColor: "rgba(244, 114, 182, 0.35)",
						borderColor: "rgba(244, 114, 182, 0.6)",
						borderWidth: 1,
						yAxisID: "yIndicators",
						order: 2,
					},
					{
						type: "line" as const,
						label: `Basal Body Temp (${tempUnit})`,
						data: temps,
						borderColor: "#7c3aed",
						backgroundColor: "rgba(124, 58, 237, 0.1)",
						pointBackgroundColor: pointBgColors,
						pointBorderColor: pointBorderColors,
						pointRadius,
						pointHoverRadius: 7,
						tension: 0.3,
						fill: true,
						yAxisID: "y",
						order: 1,
					},
				],
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				scales: {
					x: {
						ticks: {
							maxRotation: 45,
							maxTicksLimit: 15,
							font: { size: 11 },
							color: "#fff",
						},
						grid: { display: false },
					},
					y: {
						position: "left",
						title: {
							display: true,
							text: `Temperature (${tempUnit})`,
							font: { size: 12 },
							color: "#fff",
						},
						suggestedMin: 35.5,
						suggestedMax: 37.5,
						ticks: { font: { size: 14 }, color: "#fff" },
					},
					yIndicators: {
						position: "right",
						title: {
							display: true,
							text: "Indicators",
							font: { size: 12 },
							color: "#fff",
						},
						min: 0,
						max: maxIndicators + 1,
						ticks: {
							stepSize: 1,
							font: { size: 11 },
							color: "#fff",
						},
						grid: { display: false },
					},
				},
				plugins: {
					tooltip: {
						callbacks: {
							afterLabel: (ctx: TooltipItem<"line">) => {
								const entry = bbtEntries[ctx.dataIndex];
								const lines: string[] = [];
								const lh = normalizeLhSurge(entry.lhSurge);
								if (lh > 0) lines.push(`LH Surge: ${LH_LABELS[lh]}`);
								if (entry.cervicalMucus)
									lines.push(
										`Mucus: ${MUCUS_LABELS[entry.cervicalMucus] || entry.cervicalMucus}`,
									);
								const activeIndicators = getActiveIndicatorLabels(
									entry as unknown as Record<string, unknown>,
								);
								if (activeIndicators.length > 0)
									lines.push(`Indicators: ${activeIndicators.join(", ")}`);
								if (ovulationDays.has(entry.date)) lines.push("Ovulation Day");
								if (fertileWindowDays.has(entry.date))
									lines.push("Fertile Window");
								if (entry.notes) lines.push(`Notes: ${entry.notes}`);
								return lines;
							},
						},
					},
					legend: { display: false },
				},
			},
		});
	}

	private renderRecentEntries(entries: HealthEntry[]) {
		const list = this.shadow.querySelector("#entry-list") as HTMLElement;
		const recent = entries.slice(-10).reverse();

		if (recent.length === 0) {
			list.innerHTML =
				'<p style="color:var(--color-text,#6b7280);font-size:0.875rem;">No entries in this range.</p>';
			return;
		}

		list.innerHTML = "";
		for (const entry of recent) {
			const card = document.createElement("entry-card");
			card.setAttribute("entry-id", entry.id);
			card.setAttribute("entry-data", JSON.stringify(entry));
			card.addEventListener("entry-deleted", () => {
				this.entries = this.entries.filter((e) => e.id !== entry.id);
				const content = this.shadow.querySelector(
					"#main-content",
				) as HTMLElement;
				if (this.entries.length === 0) {
					this.renderEmpty(content);
				} else {
					this.renderDashboard(content);
				}
			});
			card.addEventListener("entry-edit", () => {
				navigate("/entry");
			});
			list.appendChild(card);
		}
	}
}

customElements.define("metric-chart", MetricChart);
