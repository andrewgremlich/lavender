import { ChevronDown, createElement, Trash2 } from "lucide";

import { api } from "../services/api";
import { countIndicators, INDICATORS } from "../utils/indicators";
import { celsiusToFahrenheit, getUnitSystem } from "../utils/units";

const MUCUS_LABELS: Record<string, string> = {
	dry: "Dry",
	sticky: "Sticky",
	creamy: "Creamy",
	watery: "Watery",
	eggWhite: "Egg White",
};

const FLOW_LABELS: Record<string, string> = {
	light: "Light",
	medium: "Medium",
	heavy: "Heavy",
};

class EntryCard extends HTMLElement {
	private shadow: ShadowRoot;
	private expanded = false;

	constructor() {
		super();
		this.shadow = this.attachShadow({ mode: "open" });
	}

	connectedCallback() {
		this.render();
	}

	private get entryId(): string {
		return this.getAttribute("entry-id") ?? "";
	}

	private get entryData(): Record<string, unknown> {
		try {
			return JSON.parse(this.getAttribute("entry-data") ?? "{}");
		} catch {
			return {};
		}
	}

	private buildExpandedDetails(data: Record<string, unknown>): string {
		const rows: string[] = [];

		if (data.basalBodyTemp != null) {
			const tempC = data.basalBodyTemp as number;
			const isUS = getUnitSystem() === "us";
			const temp = isUS ? celsiusToFahrenheit(tempC) : tempC;
			const unit = isUS ? "\u00b0F" : "\u00b0C";
			rows.push(
				`<div class="detail-row"><span class="detail-label">Basal Body Temp</span><span class="detail-value">${temp.toFixed(2)}${unit}</span></div>`,
			);
		}
		if (data.cervicalMucus) {
			rows.push(
				`<div class="detail-row"><span class="detail-label">Cervical Mucus</span><span class="detail-value">${MUCUS_LABELS[data.cervicalMucus as string] || data.cervicalMucus}</span></div>`,
			);
		}
		for (const ind of INDICATORS) {
			if (data[ind.key]) {
				rows.push(
					`<div class="detail-row"><span class="detail-label">${ind.label}</span><span class="detail-value">Yes</span></div>`,
				);
			}
		}
		if (data.bleedingStart) {
			rows.push(
				`<div class="detail-row"><span class="detail-label">Bleeding Started</span><span class="detail-value">Yes</span></div>`,
			);
		}
		if (data.bleedingEnd) {
			rows.push(
				`<div class="detail-row"><span class="detail-label">Bleeding Ended</span><span class="detail-value">Yes</span></div>`,
			);
		}
		if (data.bleedingFlow) {
			rows.push(
				`<div class="detail-row"><span class="detail-label">Flow Intensity</span><span class="detail-value">${FLOW_LABELS[data.bleedingFlow as string] || data.bleedingFlow}</span></div>`,
			);
		}
		if (data.notes) {
			rows.push(
				`<div class="detail-row notes-row"><span class="detail-label">Notes</span><span class="detail-value">${this.escapeHtml(data.notes as string)}</span></div>`,
			);
		}

		if (rows.length === 0) {
			rows.push(
				'<div class="detail-row"><span class="detail-value" style="opacity:0.5">No details recorded</span></div>',
			);
		}

		return rows.join("");
	}

	private escapeHtml(str: string): string {
		const div = document.createElement("div");
		div.textContent = str;
		return div.innerHTML;
	}

	private render() {
		const data = this.entryData;
		const tags: string[] = [];

		if (data.basalBodyTemp != null) {
			const tempC = data.basalBodyTemp as number;
			const isUS = getUnitSystem() === "us";
			const temp = isUS ? celsiusToFahrenheit(tempC) : tempC;
			const unit = isUS ? "\u00b0F" : "\u00b0C";
			tags.push(`<span class="entry-tag">${temp.toFixed(2)}${unit}</span>`);
		}
		if (data.cervicalMucus) {
			tags.push(
				`<span class="entry-tag">${MUCUS_LABELS[data.cervicalMucus as string] || data.cervicalMucus}</span>`,
			);
		}
		if (data.bleedingStart || data.bleedingFlow) {
			const flowText = data.bleedingFlow
				? ` (${FLOW_LABELS[data.bleedingFlow as string] || data.bleedingFlow})`
				: "";
			tags.push(
				`<span class="entry-tag bleeding">Period${flowText}</span>`,
			);
		}
		const indCount = countIndicators(data);
		if (indCount > 0) {
			tags.push(
				`<span class="entry-tag indicators">${indCount} indicator${indCount > 1 ? "s" : ""}</span>`,
			);
		}

		this.shadow.innerHTML = `
      <style>
        *, *::before, *::after { box-sizing: border-box; }
        :host { display: block; }
        .entry-card {
          background: var(--color-surface, #fff);
          border-radius: 0.5rem;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
          overflow: hidden;
        }
        .entry-header {
          padding: 0.75rem 1rem;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 0.75rem;
          cursor: pointer;
          user-select: none;
        }
        .entry-header:hover {
          background: rgba(124, 58, 237, 0.04);
        }
        .chevron {
          display: flex;
          align-items: center;
          color: var(--color-text, #9ca3af);
          transition: transform 0.2s ease;
          flex-shrink: 0;
        }
        .chevron.expanded { transform: rotate(180deg); }
        .chevron svg { width: 16px; height: 16px; }
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
          flex: 1;
          font-size: 0.8125rem;
          color: var(--color-text, #6b7280);
        }
        .entry-tag {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.125rem 0.5rem;
          border-radius: 999px;
          font-size: 0.75rem;
          background: var(--color-border, #e5e7eb);
        }
        .entry-tag.indicators { background: #fce7f3; color: #9d174d; }
        .entry-tag.bleeding { background: #fee2e2; color: #991b1b; }
        .delete-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          background: none;
          border: none;
          color: var(--color-text, #9ca3af);
          cursor: pointer;
          border-radius: 0.375rem;
          padding: 0.25rem;
          margin-left: auto;
          transition: color 0.15s, background 0.15s;
          flex-shrink: 0;
        }
        .delete-btn:hover { color: #dc2626; background: rgba(220,38,38,0.08); }
        .delete-btn svg { width: 16px; height: 16px; }
        .expanded-content {
          max-height: 0;
          overflow: hidden;
          transition: max-height 0.25s ease;
        }
        .expanded-content.open {
          max-height: 500px;
        }
        .expanded-inner {
          padding: 0 1rem 0.75rem;
          border-top: 1px solid var(--color-border, #e5e7eb);
        }
        .detail-row {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          padding: 0.375rem 0;
          font-size: 0.8125rem;
          border-bottom: 1px solid var(--color-border, #f3f4f6);
        }
        .detail-row:last-child { border-bottom: none; }
        .detail-label {
          color: var(--color-text, #6b7280);
          font-weight: 500;
        }
        .detail-value {
          color: var(--color-text, #374151);
          text-align: right;
        }
        .notes-row {
          flex-direction: column;
          gap: 0.25rem;
        }
        .notes-row .detail-value {
          text-align: left;
          white-space: pre-wrap;
          word-break: break-word;
        }
      </style>
      <div class="entry-card">
        <div class="entry-header" id="header">
          <span class="chevron" id="chevron"></span>
          <span class="entry-date">${data.date ?? ""}</span>
          <div class="entry-details">${tags.join("") || '<span style="opacity:0.5">No details</span>'}</div>
          <button class="delete-btn" id="delete-btn" title="Delete entry"></button>
        </div>
        <div class="expanded-content" id="expanded-content">
          <div class="expanded-inner">
            ${this.buildExpandedDetails(data)}
          </div>
        </div>
      </div>
    `;

		const chevron = this.shadow.querySelector("#chevron") as HTMLElement;
		chevron.appendChild(createElement(ChevronDown));

		const header = this.shadow.querySelector("#header") as HTMLElement;
		const expandedContent = this.shadow.querySelector(
			"#expanded-content",
		) as HTMLElement;

		header.addEventListener("click", (e) => {
			if ((e.target as HTMLElement).closest("#delete-btn")) return;
			this.expanded = !this.expanded;
			expandedContent.classList.toggle("open", this.expanded);
			chevron.classList.toggle("expanded", this.expanded);
		});

		const deleteBtn = this.shadow.querySelector(
			"#delete-btn",
		) as HTMLButtonElement;
		deleteBtn.appendChild(createElement(Trash2));

		deleteBtn.addEventListener("click", async (e) => {
			e.stopPropagation();
			const id = this.entryId;
			if (!id) return;
			deleteBtn.disabled = true;
			try {
				await api.metrics.delete(id);
				this.dispatchEvent(
					new CustomEvent("entry-deleted", { bubbles: true, composed: true }),
				);
			} catch {
				deleteBtn.disabled = false;
			}
		});
	}
}

customElements.define("entry-card", EntryCard);
