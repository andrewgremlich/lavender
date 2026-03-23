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

function formatTemp(tempC: number): string {
	const isUS = getUnitSystem() === "us";
	const temp = isUS ? celsiusToFahrenheit(tempC) : tempC;
	const unit = isUS ? "\u00b0F" : "\u00b0C";
	return `${temp.toFixed(2)}${unit}`;
}

function detailRow(label: string, value: string, cssClass = ""): string {
	return `<div class="detail-row ${cssClass}"><span class="detail-label">${label}</span><span class="detail-value">${value}</span></div>`;
}

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
			rows.push(detailRow("Basal Body Temp", formatTemp(data.basalBodyTemp as number)));
		}
		if (data.cervicalMucus) {
			rows.push(detailRow("Cervical Mucus", MUCUS_LABELS[data.cervicalMucus as string] || (data.cervicalMucus as string)));
		}
		for (const ind of INDICATORS) {
			if (data[ind.key]) {
				rows.push(detailRow(ind.label, "Yes"));
			}
		}
		if (data.bleedingStart) {
			rows.push(detailRow("Bleeding Started", "Yes"));
		}
		if (data.bleedingEnd) {
			rows.push(detailRow("Bleeding Ended", "Yes"));
		}
		if (data.bleedingFlow) {
			rows.push(detailRow("Flow Intensity", FLOW_LABELS[data.bleedingFlow as string] || (data.bleedingFlow as string)));
		}
		if (data.notes) {
			rows.push(detailRow("Notes", this.escapeHtml(data.notes as string), "notes-row"));
		}

		if (rows.length === 0) {
			rows.push('<div class="detail-row"><span class="detail-value" style="opacity:0.5">No details recorded</span></div>');
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
			tags.push(`<span class="entry-tag">${formatTemp(data.basalBodyTemp as number)}</span>`);
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
      <link rel="stylesheet" href="/styles/entry-card.css">
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
