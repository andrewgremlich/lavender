import { createElement, Trash2 } from "lucide";
import { api } from "../services/api";
import { celsiusToFahrenheit, getUnitSystem } from "../utils/units";

const MUCUS_LABELS: Record<string, string> = {
	dry: "Dry",
	sticky: "Sticky",
	creamy: "Creamy",
	watery: "Watery",
	eggWhite: "Egg White",
};

class EntryCard extends HTMLElement {
	private shadow: ShadowRoot;

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
		if (data.lhSurge) tags.push('<span class="entry-tag lh">LH Surge</span>');
		if (data.ovulationDay)
			tags.push('<span class="entry-tag ovulation">Ovulation</span>');
		if (data.fertileWindow)
			tags.push('<span class="entry-tag fertile">Fertile</span>');

		this.shadow.innerHTML = `
      <style>
        *, *::before, *::after { box-sizing: border-box; }
        :host { display: block; }
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
        .entry-tag.lh { background: #fef3c7; color: #92400e; }
        .entry-tag.ovulation { background: #ede9fe; color: #6d28d9; }
        .entry-tag.fertile { background: #ecfdf5; color: #065f46; }
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
      </style>
      <div class="entry-card">
        <span class="entry-date">${data.date ?? ""}</span>
        <div class="entry-details">${tags.join("") || '<span style="opacity:0.5">No details</span>'}</div>
        <button class="delete-btn" id="delete-btn" title="Delete entry"></button>
      </div>
    `;

		const deleteBtn = this.shadow.querySelector("#delete-btn") as HTMLButtonElement;
		deleteBtn.appendChild(createElement(Trash2));

		deleteBtn.addEventListener("click", async () => {
			const id = this.entryId;
			if (!id) return;
			deleteBtn.disabled = true;
			try {
				await api.metrics.delete(id);
				this.dispatchEvent(new CustomEvent("entry-deleted", { bubbles: true, composed: true }));
			} catch {
				deleteBtn.disabled = false;
			}
		});
	}
}

customElements.define("entry-card", EntryCard);
