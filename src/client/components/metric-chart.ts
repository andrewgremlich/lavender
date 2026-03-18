import type { TooltipItem } from 'chart.js';
import Chart from 'chart.js/auto';

import { decrypt, getStoredKey, importKey } from '../crypto/encryption.js';
import { navigate } from '../router.js';
import { api } from '../services/api.js';

interface HealthEntryData {
  date: string;
  basalBodyTemp?: number;
  cervicalMucus?: 'dry' | 'sticky' | 'creamy' | 'watery' | 'eggWhite';
  lhSurge?: boolean;
  ovulationDay?: boolean;
  fertileWindow?: boolean;
  notes?: string;
}

type DateRange = '30' | '90' | '180' | '365' | 'all';

const MUCUS_LABELS: Record<string, string> = {
  dry: 'Dry',
  sticky: 'Sticky',
  creamy: 'Creamy',
  watery: 'Watery',
  eggWhite: 'Egg White',
};

class MetricChart extends HTMLElement {
  private shadow: ShadowRoot;
  private chart: Chart | null = null;
  private entries: HealthEntryData[] = [];
  private selectedRange: DateRange = '30';

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this.loadData();
  }

  disconnectedCallback() {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
  }

  private render() {
    this.shadow.innerHTML = `
      <link rel="stylesheet" href="/styles/main.css">
      <style>
        :host { display: block; }
        h2 { color: var(--color-text, #1f2937); margin: 0 0 1rem; font-size: 1.5rem; }

        .range-selector {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1rem;
          flex-wrap: wrap;
        }
        .range-btn {
          padding: 0.375rem 0.75rem;
          border: 1px solid var(--color-border, #d1d5db);
          border-radius: 999px;
          background: var(--color-surface, #fff);
          color: var(--color-text-secondary, #6b7280);
          font-size: 0.8125rem;
          cursor: pointer;
          transition: all 0.2s;
        }
        .range-btn:hover { border-color: var(--color-primary, #7c3aed); }
        .range-btn.active {
          background: var(--color-primary, #7c3aed);
          color: #fff;
          border-color: var(--color-primary, #7c3aed);
        }

        .chart-card {
          background: var(--color-surface, #fff);
          border-radius: 0.75rem;
          padding: 1rem;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          margin-bottom: 1.5rem;
        }
        .chart-container {
          position: relative;
          width: 100%;
          max-height: 350px;
        }
        canvas { width: 100% !important; }

        .legend-section {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
          margin-top: 0.75rem;
          padding-top: 0.75rem;
          border-top: 1px solid var(--color-border, #e5e7eb);
        }
        .legend-item {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          font-size: 0.75rem;
          color: var(--color-text-secondary, #6b7280);
        }
        .legend-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .summary-section { margin-top: 1.5rem; }
        .summary-section h3 {
          font-size: 1.125rem;
          color: var(--color-text, #1f2937);
          margin: 0 0 0.75rem;
        }
        .entry-list { display: flex; flex-direction: column; gap: 0.5rem; }
        .entry-card {
          background: var(--color-surface, #fff);
          border-radius: 0.5rem;
          padding: 0.75rem 1rem;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 0.75rem;
        }
        .entry-date {
          font-weight: 600;
          color: var(--color-primary, #7c3aed);
          font-size: 0.875rem;
          min-width: 90px;
        }
        .entry-details {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          font-size: 0.8125rem;
          color: var(--color-text-secondary, #6b7280);
        }
        .entry-tag {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.125rem 0.5rem;
          border-radius: 999px;
          font-size: 0.75rem;
          background: #f3f4f6;
        }
        .entry-tag.lh { background: #fef3c7; color: #92400e; }
        .entry-tag.ovulation { background: #ede9fe; color: #6d28d9; }
        .entry-tag.fertile { background: #ecfdf5; color: #065f46; }

        .empty-state {
          text-align: center;
          padding: 3rem 1rem;
          color: var(--color-text-secondary, #6b7280);
        }
        .empty-state h3 { color: var(--color-text, #1f2937); margin: 0 0 0.5rem; }
        .empty-state p { margin: 0 0 1.5rem; }
        .empty-state a {
          display: inline-block;
          padding: 0.75rem 1.5rem;
          background: var(--color-primary, #7c3aed);
          color: #fff;
          border-radius: 0.5rem;
          text-decoration: none;
          font-weight: 600;
          cursor: pointer;
        }
        .empty-state a:hover { background: var(--color-primary-dark, #6d28d9); }

        .loading {
          text-align: center;
          padding: 3rem;
          color: var(--color-text-secondary, #6b7280);
        }
        .error-msg {
          background: #fef2f2;
          color: #dc2626;
          padding: 0.75rem;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          margin-bottom: 1rem;
        }
      </style>
      <h2>Dashboard</h2>
      <div id="main-content">
        <div class="loading" id="loading">Loading your data...</div>
      </div>
    `;
  }

  private async loadData() {
    const content = this.shadow.querySelector('#main-content') as HTMLElement;

    try {
      const storedKey = getStoredKey();
      if (!storedKey) {
        content.innerHTML = '<div class="error-msg">Encryption key not found. Please log in again.</div>';
        return;
      }

      const cryptoKey = await importKey(storedKey);
      const rawEntries = await api.metrics.getAll();

      if (rawEntries.length === 0) {
        this.renderEmpty(content);
        return;
      }

      const decryptedEntries: HealthEntryData[] = [];
      for (const raw of rawEntries) {
        try {
          const decrypted = await decrypt(raw.encryptedData, raw.iv, cryptoKey);
          decryptedEntries.push(JSON.parse(decrypted) as HealthEntryData);
        } catch {
          // Skip entries that fail to decrypt
        }
      }

      decryptedEntries.sort((a, b) => a.date.localeCompare(b.date));
      this.entries = decryptedEntries;

      this.renderDashboard(content);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      content.innerHTML = `<div class="error-msg">Failed to load data: ${message}</div>`;
    }
  }

  private renderEmpty(container: HTMLElement) {
    container.innerHTML = `
      <div class="empty-state">
        <h3>No Data Yet</h3>
        <p>Start tracking your health metrics to see trends and insights.</p>
        <a id="add-data-link">Add Your First Entry</a>
      </div>
    `;
    container.querySelector('#add-data-link')?.addEventListener('click', () => {
      navigate('/entry');
    });
  }

  private renderDashboard(container: HTMLElement) {
    container.innerHTML = `
      <div class="range-selector">
        <button class="range-btn ${this.selectedRange === '30' ? 'active' : ''}" data-range="30">30 Days</button>
        <button class="range-btn ${this.selectedRange === '90' ? 'active' : ''}" data-range="90">3 Months</button>
        <button class="range-btn ${this.selectedRange === '180' ? 'active' : ''}" data-range="180">6 Months</button>
        <button class="range-btn ${this.selectedRange === '365' ? 'active' : ''}" data-range="365">1 Year</button>
        <button class="range-btn ${this.selectedRange === 'all' ? 'active' : ''}" data-range="all">All</button>
      </div>
      <div class="chart-card">
        <div class="chart-container">
          <canvas id="bbt-chart"></canvas>
        </div>
        <div class="legend-section">
          <div class="legend-item"><span class="legend-dot" style="background:#7c3aed"></span> BBT</div>
          <div class="legend-item"><span class="legend-dot" style="background:#f59e0b"></span> LH Surge</div>
          <div class="legend-item"><span class="legend-dot" style="background:#ec4899"></span> Ovulation</div>
          <div class="legend-item"><span class="legend-dot" style="background:#10b981;opacity:0.3"></span> Fertile Window</div>
        </div>
      </div>
      <div class="summary-section">
        <h3>Recent Entries</h3>
        <div class="entry-list" id="entry-list"></div>
      </div>
    `;

    // Range selector
    this.shadow.querySelectorAll('.range-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.selectedRange = (btn as HTMLElement).dataset.range as DateRange;
        this.renderDashboard(container);
      });
    });

    const filtered = this.getFilteredEntries();
    this.renderChart(filtered);
    this.renderRecentEntries(filtered);
  }

  private getFilteredEntries(): HealthEntryData[] {
    if (this.selectedRange === 'all') return this.entries;

    const days = Number.parseInt(this.selectedRange, 10);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().split('T')[0];

    return this.entries.filter((e) => e.date >= cutoffStr);
  }

  private renderChart(entries: HealthEntryData[]) {
    const canvas = this.shadow.querySelector('#bbt-chart') as HTMLCanvasElement;
    if (!canvas) return;

    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }

    const bbtEntries = entries.filter((e) => e.basalBodyTemp != null);
    const labels = bbtEntries.map((e) => e.date);
    const temps = bbtEntries.map((e) => e.basalBodyTemp ?? 0);

    // Create point colors based on indicators
    const pointBorderColors = bbtEntries.map((e) => {
      if (e.ovulationDay) return '#ec4899';
      if (e.lhSurge) return '#f59e0b';
      return '#7c3aed';
    });
    const pointRadius = bbtEntries.map((e) => {
      if (e.ovulationDay || e.lhSurge) return 6;
      return 3;
    });
    const pointBgColors = bbtEntries.map((e) => {
      if (e.ovulationDay) return '#ec4899';
      if (e.lhSurge) return '#f59e0b';
      if (e.fertileWindow) return 'rgba(16, 185, 129, 0.4)';
      return '#7c3aed';
    });

    this.chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Basal Body Temp (\u00b0C)',
            data: temps,
            borderColor: '#7c3aed',
            backgroundColor: 'rgba(124, 58, 237, 0.1)',
            pointBackgroundColor: pointBgColors,
            pointBorderColor: pointBorderColors,
            pointRadius,
            pointHoverRadius: 7,
            tension: 0.3,
            fill: true,
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
            },
            grid: { display: false },
          },
          y: {
            title: { display: true, text: 'Temperature (\u00b0C)', font: { size: 12 } },
            suggestedMin: 35.5,
            suggestedMax: 37.5,
            ticks: { font: { size: 11 } },
          },
        },
        plugins: {
          tooltip: {
            callbacks: {
              afterLabel: (ctx: TooltipItem<'line'>) => {
                const entry = bbtEntries[ctx.dataIndex];
                const lines: string[] = [];
                if (entry.cervicalMucus) lines.push(`Mucus: ${MUCUS_LABELS[entry.cervicalMucus] || entry.cervicalMucus}`);
                if (entry.lhSurge) lines.push('LH Surge detected');
                if (entry.ovulationDay) lines.push('Ovulation Day');
                if (entry.fertileWindow) lines.push('Fertile Window');
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

  private renderRecentEntries(entries: HealthEntryData[]) {
    const list = this.shadow.querySelector('#entry-list') as HTMLElement;
    const recent = entries.slice(-10).reverse();

    if (recent.length === 0) {
      list.innerHTML = '<p style="color:var(--color-text-secondary,#6b7280);font-size:0.875rem;">No entries in this range.</p>';
      return;
    }

    list.innerHTML = recent
      .map((entry) => {
        const tags: string[] = [];
        if (entry.basalBodyTemp != null) {
          tags.push(`<span class="entry-tag">${entry.basalBodyTemp.toFixed(2)}\u00b0C</span>`);
        }
        if (entry.cervicalMucus) {
          tags.push(`<span class="entry-tag">${MUCUS_LABELS[entry.cervicalMucus] || entry.cervicalMucus}</span>`);
        }
        if (entry.lhSurge) tags.push('<span class="entry-tag lh">LH Surge</span>');
        if (entry.ovulationDay) tags.push('<span class="entry-tag ovulation">Ovulation</span>');
        if (entry.fertileWindow) tags.push('<span class="entry-tag fertile">Fertile</span>');

        return `
          <div class="entry-card">
            <span class="entry-date">${entry.date}</span>
            <div class="entry-details">${tags.join('')}</div>
          </div>
        `;
      })
      .join('');
  }
}

customElements.define('metric-chart', MetricChart);
