import type { HealthEntryData } from "@shared/types";
import type { TooltipItem } from "chart.js";
import Chart from "chart.js/auto";

import { decrypt, getStoredKey, importKey } from "../crypto/encryption";
import { api } from "../services/api";
import { metricsStore } from "../services/metrics-store";
import { refreshFromServer } from "../services/sync-engine";
import {
	getCycleDetails,
	getCycleSegments,
	getPredictionAccuracy,
	toFertilityEntry,
} from "../utils/fertility";
import { celsiusToFahrenheit, getUnitSystem } from "../utils/units";

type HealthEntry = HealthEntryData & { id: string };
type Tab = "luteal" | "accuracy" | "comparison";

const CYCLE_COLORS = [
	"#7c3aed",
	"#ec4899",
	"#10b981",
	"#f59e0b",
	"#3b82f6",
	"#ef4444",
];

class AnalyticsPanel extends HTMLElement {
	private shadow: ShadowRoot;
	private entries: HealthEntry[] = [];
	private activeTab: Tab = "luteal";
	private charts: Chart[] = [];

	constructor() {
		super();
		this.shadow = this.attachShadow({ mode: "open" });
	}

	connectedCallback() {
		this.renderShell();
		this.loadData();
	}

	disconnectedCallback() {
		this.destroyCharts();
	}

	private destroyCharts() {
		for (const c of this.charts) c.destroy();
		this.charts = [];
	}

	private renderShell() {
		this.shadow.innerHTML = `
      <link rel="stylesheet" href="/styles/main.css">
      <link rel="stylesheet" href="/styles/analytics-panel.css">
      <h2>Analytics</h2>
      <div id="main-content">
        <div class="loading">Loading your data…</div>
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

			const cachedEntries = await metricsStore.getAll();
			if (cachedEntries.length > 0) {
				await this.decryptAndRender(cachedEntries, cryptoKey, content);
			}

			const pendingQueue = await metricsStore.getQueue();
			if (pendingQueue.length > 0) return;

			const serverEntries = await refreshFromServer();
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
			content.innerHTML = `
        <div class="empty-state">
          <h3>No Data Yet</h3>
          <p>Add health entries to see analytics and trends.</p>
        </div>`;
			return;
		}

		const decryptedEntries: HealthEntry[] = [];
		for (const raw of rawEntries) {
			try {
				const plaintext = await decrypt(raw.encryptedData, raw.iv, cryptoKey);
				const parsed = JSON.parse(plaintext) as HealthEntryData;
				decryptedEntries.push({ ...parsed, id: raw.id });
			} catch {
				// skip undecryptable entries
			}
		}

		decryptedEntries.sort((a, b) => a.date.localeCompare(b.date));
		this.entries = decryptedEntries;
		this.renderPanel(content);
	}

	private renderPanel(content: HTMLElement) {
		content.innerHTML = `
      <div class="tab-bar">
        <button class="tab-btn ${this.activeTab === "luteal" ? "active" : ""}" data-tab="luteal">Luteal Trends</button>
        <button class="tab-btn ${this.activeTab === "accuracy" ? "active" : ""}" data-tab="accuracy">Prediction Accuracy</button>
        <button class="tab-btn ${this.activeTab === "comparison" ? "active" : ""}" data-tab="comparison">Cycle Comparison</button>
      </div>
      <div id="tab-content"></div>
    `;

		content.querySelectorAll(".tab-btn").forEach((btn) => {
			btn.addEventListener("click", () => {
				this.activeTab = (btn as HTMLElement).dataset.tab as Tab;
				this.renderPanel(content);
			});
		});

		this.destroyCharts();
		const tabContent = content.querySelector("#tab-content") as HTMLElement;

		if (this.activeTab === "luteal") this.renderLutealTrends(tabContent);
		else if (this.activeTab === "accuracy")
			this.renderPredictionAccuracy(tabContent);
		else this.renderCycleComparison(tabContent);
	}

	// -------------------------------------------------------------------------
	// Luteal Phase Trends
	// -------------------------------------------------------------------------

	private renderLutealTrends(container: HTMLElement) {
		const fertilityEntries = this.entries.map(toFertilityEntry);
		const cycleDetails = getCycleDetails(fertilityEntries);
		const withLuteal = cycleDetails.filter(
			(c) => c.lutealPhaseLength !== undefined,
		);

		if (withLuteal.length < 2) {
			container.innerHTML = `
        <div class="insight-card">
          <div class="empty-state small">
            <h3>Not Enough Data</h3>
            <p>Luteal phase trends require at least 2 complete cycles with detected ovulation. Keep logging daily to unlock this view.</p>
          </div>
        </div>`;
			return;
		}

		const lengths = withLuteal.map((c) => c.lutealPhaseLength as number);
		const avg = Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length);
		const lastTwo = lengths.slice(-2);
		const isConcerning = lastTwo.length === 2 && lastTwo.every((l) => l < 10);
		const isTrending =
			lengths.length >= 3 &&
			lengths[lengths.length - 1] < lengths[lengths.length - 2] &&
			lengths[lengths.length - 2] < lengths[lengths.length - 3];

		container.innerHTML = `
      ${
				isConcerning
					? `<div class="alert-banner warning">Short luteal phase detected in last 2 cycles (&lt;10 days). Consider discussing with a healthcare provider.</div>`
					: isTrending
						? `<div class="alert-banner info">Luteal phase length has been decreasing over the last 3 cycles.</div>`
						: ""
			}
      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-value">${avg}</div>
          <div class="stat-label">Avg Luteal Phase (days)</div>
        </div>
        <div class="stat-card">
          <div class="stat-value ${lengths[lengths.length - 1] < 10 ? "warning-text" : ""}">${lengths[lengths.length - 1]}</div>
          <div class="stat-label">Last Cycle (days)</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${withLuteal.length}</div>
          <div class="stat-label">Cycles Analyzed</div>
        </div>
      </div>
      <div class="chart-card">
        <div class="chart-container">
          <canvas id="luteal-chart"></canvas>
        </div>
        <div class="chart-legend-row">
          <span class="legend-item"><span class="legend-line dashed red"></span> Short (&lt;10 days)</span>
          <span class="legend-item"><span class="legend-line dashed yellow"></span> Low-normal (&lt;12 days)</span>
        </div>
      </div>
    `;

		const canvas = container.querySelector(
			"#luteal-chart",
		) as HTMLCanvasElement;
		const labels = withLuteal.map((c) => c.periodStart);
		const refLine10 = Array(labels.length).fill(10);
		const refLine12 = Array(labels.length).fill(12);

		const chart = new Chart(canvas, {
			data: {
				labels,
				datasets: [
					{
						type: "line" as const,
						label: "Luteal Phase (days)",
						data: lengths,
						borderColor: "#7c3aed",
						backgroundColor: "rgba(124,58,237,0.1)",
						pointBackgroundColor: lengths.map((l) =>
							l < 10 ? "#ef4444" : l < 12 ? "#f59e0b" : "#7c3aed",
						),
						pointRadius: 6,
						tension: 0.3,
						fill: true,
						order: 1,
					},
					{
						type: "line" as const,
						label: "Short threshold (10 days)",
						data: refLine10,
						borderColor: "rgba(239,68,68,0.7)",
						borderDash: [6, 3],
						pointRadius: 0,
						fill: false,
						order: 2,
					},
					{
						type: "line" as const,
						label: "Low-normal threshold (12 days)",
						data: refLine12,
						borderColor: "rgba(245,158,11,0.7)",
						borderDash: [6, 3],
						pointRadius: 0,
						fill: false,
						order: 3,
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
							maxTicksLimit: 12,
							font: { size: 11 },
							color: "#fff",
						},
						grid: { display: false },
					},
					y: {
						title: { display: true, text: "Days", color: "#fff" },
						min: 0,
						max: 20,
						ticks: { stepSize: 2, font: { size: 11 }, color: "#fff" },
					},
				},
				plugins: {
					legend: { display: false },
					tooltip: {
						callbacks: {
							label: (ctx: TooltipItem<"line">) => {
								if (ctx.datasetIndex === 0) {
									return `Luteal phase: ${ctx.parsed.y} days`;
								}
								return ctx.dataset.label ?? "";
							},
						},
					},
				},
			},
		});
		this.charts.push(chart);
	}

	// -------------------------------------------------------------------------
	// Prediction Accuracy
	// -------------------------------------------------------------------------

	private renderPredictionAccuracy(container: HTMLElement) {
		const fertilityEntries = this.entries.map(toFertilityEntry);
		const records = getPredictionAccuracy(fertilityEntries);

		if (records.length === 0) {
			container.innerHTML = `
        <div class="insight-card">
          <div class="empty-state small">
            <h3>Not Enough Data</h3>
            <p>Prediction accuracy requires at least 3 recorded period start dates. Keep logging to unlock this view.</p>
          </div>
        </div>`;
			return;
		}

		const errors = records.map((r) => r.errorDays);
		const absErrors = errors.map(Math.abs);
		const avgError = Math.round(
			absErrors.reduce((a, b) => a + b, 0) / absErrors.length,
		);
		const maxError = Math.max(...absErrors);
		const accurate = absErrors.filter((e) => e <= 2).length;
		const accuracyPct = Math.round((accurate / records.length) * 100);

		container.innerHTML = `
      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-value">${accuracyPct}%</div>
          <div class="stat-label">Within ±2 Days</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${avgError}</div>
          <div class="stat-label">Avg Error (days)</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${maxError}</div>
          <div class="stat-label">Max Error (days)</div>
        </div>
      </div>
      <div class="chart-card">
        <div class="chart-container">
          <canvas id="accuracy-chart"></canvas>
        </div>
        <p class="chart-note">Positive = period came later than predicted. Negative = earlier.</p>
      </div>
    `;

		const canvas = container.querySelector(
			"#accuracy-chart",
		) as HTMLCanvasElement;
		const labels = records.map((r) => r.periodStart);

		const chart = new Chart(canvas, {
			type: "bar",
			data: {
				labels,
				datasets: [
					{
						label: "Prediction Error (days)",
						data: errors,
						backgroundColor: errors.map((e) =>
							Math.abs(e) <= 2
								? "rgba(16,185,129,0.7)"
								: Math.abs(e) <= 5
									? "rgba(245,158,11,0.7)"
									: "rgba(239,68,68,0.7)",
						),
						borderColor: errors.map((e) =>
							Math.abs(e) <= 2
								? "#10b981"
								: Math.abs(e) <= 5
									? "#f59e0b"
									: "#ef4444",
						),
						borderWidth: 1,
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
							maxTicksLimit: 12,
							font: { size: 11 },
							color: "#fff",
						},
						grid: { display: false },
					},
					y: {
						title: { display: true, text: "Error (days)", color: "#fff" },
						ticks: { font: { size: 11 }, color: "#fff" },
					},
				},
				plugins: {
					legend: { display: false },
					tooltip: {
						callbacks: {
							label: (ctx: TooltipItem<"bar">) => {
								const val = ctx.parsed.y as number;
								const dir = val > 0 ? "late" : val < 0 ? "early" : "exact";
								return `${Math.abs(val)} day(s) ${dir}`;
							},
						},
					},
				},
			},
		});
		this.charts.push(chart);
	}

	// -------------------------------------------------------------------------
	// Cycle Comparison
	// -------------------------------------------------------------------------

	private renderCycleComparison(container: HTMLElement) {
		const isUS = getUnitSystem() === "us";
		const tempUnit = isUS ? "\u00b0F" : "\u00b0C";

		const fertilityEntries = this.entries.map(toFertilityEntry);
		const segments = getCycleSegments(fertilityEntries);

		// Only compare cycles that have BBT data AND a detected ovulation day
		const aligned = segments.filter(
			(s) =>
				s.ovulationDay !== undefined &&
				s.entries.some((e) => e.bbt !== undefined),
		);

		if (aligned.length < 2) {
			container.innerHTML = `
        <div class="insight-card">
          <div class="empty-state small">
            <h3>Not Enough Data</h3>
            <p>Cycle comparison requires at least 2 cycles with both BBT readings and detected ovulation. Keep logging daily temperatures.</p>
          </div>
        </div>`;
			return;
		}

		// Show last 5 aligned cycles
		const recent = aligned.slice(-5);

		// Build day offset range (-20 to +20)
		const MIN_OFFSET = -20;
		const MAX_OFFSET = 20;
		const offsetRange: number[] = [];
		for (let d = MIN_OFFSET; d <= MAX_OFFSET; d++) offsetRange.push(d);

		container.innerHTML = `
      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-value">${recent.length}</div>
          <div class="stat-label">Cycles Shown</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${recent.filter((s) => s.ovulationDay).length}</div>
          <div class="stat-label">With Ovulation</div>
        </div>
      </div>
      <div class="chart-card">
        <div class="chart-container tall">
          <canvas id="comparison-chart"></canvas>
        </div>
        <div class="chart-legend-row wrap">
          ${recent
						.map(
							(s, i) =>
								`<span class="legend-item"><span class="legend-dot" style="background:${CYCLE_COLORS[i % CYCLE_COLORS.length]}"></span> Cycle ${s.index + 1} (${s.periodStart})</span>`,
						)
						.join("")}
        </div>
        <p class="chart-note">Day 0 = ovulation day. Negative days = before ovulation (follicular). Positive = after (luteal).</p>
      </div>
    `;

		const canvas = container.querySelector(
			"#comparison-chart",
		) as HTMLCanvasElement;

		const datasets = recent.map((segment, i) => {
			// Build a lookup from dayOffset → bbt
			const offsetMap = new Map<number, number>();
			for (const entry of segment.entries) {
				if (entry.bbt !== undefined) {
					const temp = isUS ? celsiusToFahrenheit(entry.bbt) : entry.bbt;
					offsetMap.set(entry.dayOffset, temp);
				}
			}

			return {
				label: `Cycle ${segment.index + 1} (${segment.periodStart})`,
				data: offsetRange.map((d) => offsetMap.get(d) ?? null),
				borderColor: CYCLE_COLORS[i % CYCLE_COLORS.length],
				backgroundColor: "transparent",
				pointRadius: offsetRange.map((d) => (offsetMap.has(d) ? 3 : 0)),
				tension: 0.3,
				spanGaps: true,
			};
		});

		// Gather all temp values for Y axis bounds
		const allTemps = datasets.flatMap((d) =>
			(d.data as (number | null)[]).filter((v): v is number => v !== null),
		);
		const buffer = isUS ? 0.5 : 0.3;
		const yMin =
			allTemps.length > 0
				? Math.floor((Math.min(...allTemps) - buffer) * 10) / 10
				: isUS
					? 96
					: 35.5;
		const yMax =
			allTemps.length > 0
				? Math.ceil((Math.max(...allTemps) + buffer) * 10) / 10
				: isUS
					? 100
					: 37.5;

		const chart = new Chart(canvas, {
			type: "line",
			data: {
				labels: offsetRange.map((d) =>
					d === 0 ? "Ovulation" : d > 0 ? `+${d}` : String(d),
				),
				datasets,
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				scales: {
					x: {
						ticks: { font: { size: 10 }, color: "#fff", maxTicksLimit: 20 },
						grid: { color: "rgba(255,255,255,0.05)" },
					},
					y: {
						title: { display: true, text: `Temp (${tempUnit})`, color: "#fff" },
						min: yMin,
						max: yMax,
						ticks: { font: { size: 11 }, color: "#fff", maxTicksLimit: 8 },
					},
				},
				plugins: {
					legend: { display: false },
					tooltip: {
						callbacks: {
							label: (ctx: TooltipItem<"line">) => {
								const val = ctx.parsed.y as number;
								return `${ctx.dataset.label}: ${val.toFixed(isUS ? 1 : 2)}${tempUnit}`;
							},
						},
					},
				},
			},
		});
		this.charts.push(chart);
	}
}

customElements.define("analytics-panel", AnalyticsPanel);
