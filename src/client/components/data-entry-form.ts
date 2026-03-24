import type { HealthEntryData } from "@shared/types";
import { encrypt, getStoredKey, importKey } from "../crypto/encryption";
import { navigate } from "../router";
import { api } from "../services/api";
import { renderIcons } from "../utils/icons";
import { INDICATORS } from "../utils/indicators";
import {
	celsiusToFahrenheit,
	fahrenheitToCelsius,
	getUnitSystem,
} from "../utils/units";

type TempUnit = "C" | "F";

interface RadioOption {
	id: string;
	value: string;
	icon: string;
	label: string;
}

const MUCUS_OPTIONS: RadioOption[] = [
	{ id: "cm-dry", value: "dry", icon: "circle", label: "Dry" },
	{ id: "cm-sticky", value: "sticky", icon: "circle-dot", label: "Sticky" },
	{ id: "cm-creamy", value: "creamy", icon: "droplet", label: "Creamy" },
	{ id: "cm-watery", value: "watery", icon: "droplets", label: "Watery" },
	{ id: "cm-eggwhite", value: "eggWhite", icon: "egg", label: "Egg White" },
];

const FLOW_OPTIONS: RadioOption[] = [
	{ id: "flow-light", value: "light", icon: "minus", label: "Light" },
	{ id: "flow-medium", value: "medium", icon: "droplet", label: "Medium" },
	{ id: "flow-heavy", value: "heavy", icon: "droplets", label: "Heavy" },
];

function radioGroup(
	name: string,
	options: RadioOption[],
	cssClass: string,
): string {
	return `<div class="${cssClass}">${options
		.map(
			(o) => `
        <div class="mucus-option">
          <input type="radio" name="${name}" id="${o.id}" value="${o.value}" />
          <label for="${o.id}">
            <i data-icon="${o.icon}" class="mucus-icon"></i>
            <span class="mucus-name">${o.label}</span>
          </label>
        </div>`,
		)
		.join("")}</div>`;
}

class DataEntryForm extends HTMLElement {
	private shadow: ShadowRoot;
	private tempUnit: TempUnit = getUnitSystem() === "us" ? "F" : "C";

	constructor() {
		super();
		this.shadow = this.attachShadow({ mode: "open" });
	}

	connectedCallback() {
		this.render();
		this.setupListeners();
	}

	private getTodayDate(): string {
		return new Date().toISOString().split("T")[0];
	}

	private render() {
		const today = this.getTodayDate();
		const isC = this.tempUnit === "C";
		const tempMin = isC ? "35" : "95";
		const tempMax = isC ? "42" : "107.6";
		const tempPlaceholder = isC ? "36.50" : "97.70";
		const tempLabel = `Basal Body Temperature (\u00b0${this.tempUnit})`;

		this.shadow.innerHTML = `
      <link rel="stylesheet" href="/styles/main.css">
      <link rel="stylesheet" href="/styles/data-entry-form.css">
      <h2>Log Health Data</h2>
      <div class="form-card">
        <div class="message error" id="error-msg"></div>
        <div class="message success" id="success-msg">
          Entry saved successfully!
          <div class="success-actions">
            <button type="button" class="btn-add-another" id="add-another-btn">Add Another</button>
            <button type="button" class="btn-view-chart" id="view-chart-btn">View Chart</button>
          </div>
        </div>
        <form id="entry-form">
          <div class="form-group">
            <label for="entry-date">Date</label>
            <input type="date" id="entry-date" name="entry-date" value="${today}" required />
          </div>

          <details class="collapsible" open>
            <summary>Temperature</summary>
            <div class="collapsible-content">
              <div class="temp-header">
                <label for="bbt">${tempLabel}</label>
                <div class="unit-toggle">
                  <button type="button" data-unit="C" class="${isC ? "active" : ""}">°C</button>
                  <button type="button" data-unit="F" class="${isC ? "" : "active"}">°F</button>
                </div>
              </div>
              <input type="number" id="bbt" name="bbt" step="0.01" min="${tempMin}" max="${tempMax}" placeholder="${tempPlaceholder}" />
            </div>
          </details>

          <details class="collapsible">
            <summary>Cervical Mucus</summary>
            <div class="collapsible-content">
              ${radioGroup("cervical-mucus", MUCUS_OPTIONS, "mucus-options")}
            </div>
          </details>

          <details class="collapsible">
            <summary>Indicators</summary>
            <div class="collapsible-content">
              <div class="toggle-group">
                ${INDICATORS.map(
									(ind) => `<label class="toggle-item" for="ind-${ind.key}">
                  <div class="toggle-switch">
                    <input type="checkbox" id="ind-${ind.key}" name="${ind.key}" />
                    <span class="toggle-slider"></span>
                  </div>
                  <span class="toggle-label">${ind.label}</span>
                </label>`,
								).join("")}
              </div>
            </div>
          </details>

          <details class="collapsible">
            <summary>Period / Bleeding</summary>
            <div class="collapsible-content">
              <div class="bleeding-options">
                <div class="bleeding-option">
                  <input type="radio" name="bleeding-status" id="bleeding-none" value="none" checked />
                  <label for="bleeding-none">None</label>
                </div>
                <div class="bleeding-option">
                  <input type="radio" name="bleeding-status" id="bleeding-started" value="started" />
                  <label for="bleeding-started">Started</label>
                </div>
                <div class="bleeding-option">
                  <input type="radio" name="bleeding-status" id="bleeding-ended" value="ended" />
                  <label for="bleeding-ended">Ended</label>
                </div>
              </div>
              <div class="flow-section">
                <label>Flow Intensity</label>
                ${radioGroup("bleeding-flow", FLOW_OPTIONS, "mucus-options")}
              </div>
            </div>
          </details>

          <details class="collapsible">
            <summary>Notes</summary>
            <div class="collapsible-content">
              <textarea id="notes" name="notes" placeholder="Any additional observations..."></textarea>
            </div>
          </details>

          <button type="submit" class="btn-submit" id="submit-btn"><i data-icon="save"></i> <span>Save Entry</span></button>
        </form>
      </div>
    `;

		renderIcons(this.shadow);
	}

	private setupListeners() {
		const form = this.shadow.querySelector("#entry-form") as HTMLFormElement;
		const successMsg = this.shadow.querySelector("#success-msg") as HTMLElement;
		const addAnotherBtn = this.shadow.querySelector(
			"#add-another-btn",
		) as HTMLButtonElement;
		const viewChartBtn = this.shadow.querySelector(
			"#view-chart-btn",
		) as HTMLButtonElement;

		// Temperature unit toggle
		const unitBtns = this.shadow.querySelectorAll(".unit-toggle button");
		unitBtns.forEach((btn) => {
			btn.addEventListener("click", () => {
				const newUnit = (btn as HTMLElement).dataset.unit as TempUnit;
				if (newUnit === this.tempUnit) return;

				const bbtInput = this.shadow.querySelector("#bbt") as HTMLInputElement;
				const currentVal = Number.parseFloat(bbtInput.value);

				this.tempUnit = newUnit;

				if (!Number.isNaN(currentVal)) {
					const converted =
						newUnit === "F"
							? celsiusToFahrenheit(currentVal)
							: fahrenheitToCelsius(currentVal);
					bbtInput.value = (Math.round(converted * 100) / 100).toString();
				}

				if (newUnit === "C") {
					bbtInput.min = "35";
					bbtInput.max = "42";
					bbtInput.placeholder = "36.50";
				} else {
					bbtInput.min = "95";
					bbtInput.max = "107.6";
					bbtInput.placeholder = "97.70";
				}

				unitBtns.forEach((b) => {
					b.classList.remove("active");
				});
				btn.classList.add("active");

				const label = this.shadow.querySelector(
					".temp-header label",
				) as HTMLElement;
				label.textContent = `Basal Body Temperature (\u00b0${newUnit})`;
			});
		});

		form.addEventListener("submit", async (e: Event) => {
			e.preventDefault();
			this.clearMessages();

			const submitBtn = this.shadow.querySelector(
				"#submit-btn",
			) as HTMLButtonElement;

			const formData = new FormData(form);
			const date = formData.get("entry-date") as string;
			const bbtRaw = formData.get("bbt") as string;
			const mucus = formData.get("cervical-mucus") as string | null;
			const notes = (formData.get("notes") as string)?.trim();
			const bleedingStatus = formData.get("bleeding-status") as string | null;
			const bleedingFlow = formData.get("bleeding-flow") as string | null;

			if (!date) {
				this.showError("Please select a date.");
				return;
			}

			const entry: HealthEntryData = { date };

			if (bbtRaw) {
				let tempC = Number.parseFloat(bbtRaw);
				if (this.tempUnit === "F") {
					tempC = Math.round(fahrenheitToCelsius(tempC) * 100) / 100;
				}
				entry.basalBodyTemp = tempC;
			}

			if (mucus) {
				entry.cervicalMucus = mucus as HealthEntryData["cervicalMucus"];
			}

			for (const ind of INDICATORS) {
				if (formData.get(ind.key)) {
					(entry as unknown as Record<string, unknown>)[ind.key] = true;
				}
			}

			if (bleedingStatus === "started") entry.bleedingStart = true;
			if (bleedingStatus === "ended") entry.bleedingEnd = true;

			if (bleedingFlow) {
				entry.bleedingFlow =
					bleedingFlow as HealthEntryData["bleedingFlow"];
			}

			if (notes) entry.notes = notes;

			try {
				submitBtn.disabled = true;
				submitBtn.innerHTML =
					'<span class="loading-spinner"></span>Encrypting & saving...';

				const storedKey = getStoredKey();
				if (!storedKey) {
					this.showError("Encryption key not found. Please log in again.");
					return;
				}

				const cryptoKey = await importKey(storedKey);
				const { encrypted, iv } = await encrypt(
					JSON.stringify(entry),
					cryptoKey,
				);
				await api.metrics.create(encrypted, iv);

				form.style.display = "none";
				successMsg.classList.add("visible");
			} catch (err: unknown) {
				const message =
					err instanceof Error
						? err.message
						: "Failed to save entry. Please try again.";
				this.showError(message);
			} finally {
				submitBtn.disabled = false;
				submitBtn.textContent = "Save Entry";
			}
		});

		addAnotherBtn.addEventListener("click", () => {
			form.reset();
			(this.shadow.querySelector("#entry-date") as HTMLInputElement).value =
				this.getTodayDate();
			form.style.display = "";
			successMsg.classList.remove("visible");
		});

		viewChartBtn.addEventListener("click", () => {
			navigate("/");
		});
	}

	private showError(msg: string) {
		const errorEl = this.shadow.querySelector("#error-msg") as HTMLElement;
		errorEl.textContent = msg;
		errorEl.classList.add("visible");
	}

	private clearMessages() {
		const errorEl = this.shadow.querySelector("#error-msg") as HTMLElement;
		const successEl = this.shadow.querySelector("#success-msg") as HTMLElement;
		errorEl.textContent = "";
		errorEl.classList.remove("visible");
		successEl.classList.remove("visible");
	}
}

customElements.define("data-entry-form", DataEntryForm);
