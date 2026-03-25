import { decrypt, getStoredKey, importKey } from "../crypto/encryption";
import { api } from "../services/api";
import { logout } from "../services/auth";
import { getUnitSystem, setUnitSystem } from "../utils/units";

function confirmDialog(
	id: string,
	message: string,
	confirmLabel: string,
): string {
	return `
    <div class="confirm-dialog" id="${id}-confirm">
      <p>${message}</p>
      <div class="confirm-actions">
        <button class="btn btn-danger" id="confirm-${id}">
          ${confirmLabel}
        </button>
        <button class="btn btn-outline" id="cancel-${id}">Cancel</button>
      </div>
    </div>`;
}

class SettingsPanel extends HTMLElement {
	private shadow: ShadowRoot;

	constructor() {
		super();
		this.shadow = this.attachShadow({ mode: "open" });
	}

	connectedCallback() {
		this.render();
		this.setupListeners();
	}

	private render() {
		const unitSystem = getUnitSystem();
		this.shadow.innerHTML = `
      <link rel="stylesheet" href="/styles/main.css">
      <link rel="stylesheet" href="/styles/settings-panel.css">

      <h2>Settings</h2>

      <!-- Units -->
      <div class="settings-card">
        <h3>Units</h3>
        <div class="form-row">
          <label for="unit-system">Measurement system</label>
          <select id="unit-system">
            <option value="metric" ${unitSystem === "metric" ? "selected" : ""}>Metric (°C, kg, cm)</option>
            <option value="us" ${unitSystem === "us" ? "selected" : ""}>US (°F, lb, in)</option>
          </select>
        </div>
        <button class="btn btn-primary" id="save-units-btn">Save</button>
        <div class="message" id="units-msg"></div>
      </div>

      <!-- Data Retention -->
      <div class="settings-card">
        <h3>Data Retention</h3>
        <div class="form-row">
          <label for="retention-period">Auto-delete entries older than</label>
          <select id="retention-period">
            <option value="180" selected>6 months</option>
            <option value="270">9 months</option>
            <option value="365">1 year</option>
          </select>
        </div>
        <button class="btn btn-primary" id="save-retention-btn">Save</button>
        <div class="message" id="retention-msg"></div>
      </div>

      <!-- Export Data -->
      <div class="settings-card">
        <h3>Export Data</h3>
        <p>Download all your health entries as a decrypted JSON file for backup.</p>
        <button class="btn btn-primary btn-full" id="export-data-btn">Export All Data</button>
        <div class="message" id="export-msg"></div>
      </div>

      <!-- Danger Zone -->
      <div class="settings-card" style="border:1px solid #fca5a5;">
        <h3 style="color:#dc2626;">Danger Zone</h3>
        <button class="btn btn-danger-outline btn-full" id="delete-data-btn">Delete All Data</button>
        ${confirmDialog("delete-data", "This will permanently delete all your health entries. This action cannot be undone.", "Yes, Delete All Data")}
        <div class="danger-spacer"></div>
        <button class="btn btn-danger btn-full" id="delete-account-btn">Delete Account</button>
        ${confirmDialog("delete-account", "This will permanently delete your account and all associated data. This cannot be undone.", "Yes, Delete My Account")}
      </div>
    `;
	}

	private setupListeners() {
		// Save units
		this.shadow
			.querySelector("#save-units-btn")
			?.addEventListener("click", () => {
				const select = this.shadow.querySelector(
					"#unit-system",
				) as unknown as HTMLSelectElement;
				const msgEl = this.shadow.querySelector("#units-msg") as HTMLElement;
				setUnitSystem(select.value as "metric" | "us");
				this.showMessage(msgEl, "Unit preference saved.", "success");
			});

		// Save retention
		this.shadow
			.querySelector("#save-retention-btn")
			?.addEventListener("click", async () => {
				const select = this.shadow.querySelector(
					"#retention-period",
				) as unknown as HTMLSelectElement;
				const msgEl = this.shadow.querySelector(
					"#retention-msg",
				) as HTMLElement;
				try {
					await api.settings.update(Number.parseInt(select.value, 10));
					this.showMessage(msgEl, "Retention period saved.", "success");
				} catch (err: unknown) {
					const message =
						err instanceof Error ? err.message : "Failed to save.";
					this.showMessage(msgEl, message, "error");
				}
			});

		// Export data
		this.shadow
			.querySelector("#export-data-btn")
			?.addEventListener("click", () => this.exportData());

		// Delete all data
		this.setupConfirmAction("delete-data", async () => {
			await api.metrics.deleteAll();
			const btn = this.shadow.querySelector(
				"#delete-data-btn",
			) as HTMLButtonElement;
			btn.textContent = "All data deleted";
			btn.disabled = true;
		});

		// Delete account
		this.setupConfirmAction("delete-account", async () => {
			await api.auth.deleteAccount();
			logout();
			window.dispatchEvent(new CustomEvent("user-logout"));
		});
	}

	private setupConfirmAction(id: string, onConfirm: () => Promise<void>) {
		const triggerBtn = this.shadow.querySelector(`#${id}-btn`) as HTMLElement;
		const dialog = this.shadow.querySelector(`#${id}-confirm`) as HTMLElement;

		triggerBtn.addEventListener("click", () => {
			dialog.classList.add("visible");
		});
		this.shadow
			.querySelector(`#cancel-${id}`)
			?.addEventListener("click", () => {
				dialog.classList.remove("visible");
			});
		this.shadow
			.querySelector(`#confirm-${id}`)
			?.addEventListener("click", async () => {
				try {
					await onConfirm();
					dialog.classList.remove("visible");
				} catch (err: unknown) {
					const message = err instanceof Error ? err.message : "Unknown error";
					alert(`Operation failed: ${message}`);
				}
			});
	}

	private async exportData() {
		const msgEl = this.shadow.querySelector("#export-msg") as HTMLElement;
		const btn = this.shadow.querySelector(
			"#export-data-btn",
		) as HTMLButtonElement;

		const storedKey = getStoredKey();
		if (!storedKey) {
			this.showMessage(
				msgEl,
				"Encryption key not found. Please log in again.",
				"error",
			);
			return;
		}

		btn.disabled = true;
		btn.textContent = "Exporting…";

		try {
			const entries = await api.metrics.getAll();
			const key = await importKey(storedKey);

			const decryptedEntries = await Promise.all(
				entries.map(async (entry) => {
					const plaintext = await decrypt(entry.encryptedData, entry.iv, key);
					return {
						id: entry.id,
						createdAt: entry.createdAt,
						expiresAt: entry.expiresAt,
						data: JSON.parse(plaintext),
					};
				}),
			);

			const exportPayload = {
				exportedAt: new Date().toISOString(),
				entryCount: decryptedEntries.length,
				entries: decryptedEntries,
			};

			const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
				type: "application/json",
			});
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `lavendar-backup-${new Date().toISOString().slice(0, 10)}.json`;
			a.click();
			URL.revokeObjectURL(url);

			this.showMessage(
				msgEl,
				`Exported ${decryptedEntries.length} entries.`,
				"success",
			);
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : "Export failed.";
			this.showMessage(msgEl, message, "error");
		} finally {
			btn.disabled = false;
			btn.textContent = "Export All Data";
		}
	}

	private showMessage(el: HTMLElement, msg: string, type: "success" | "error") {
		el.textContent = msg;
		el.className = `message visible ${type}`;
		setTimeout(() => {
			el.classList.remove("visible");
		}, 4000);
	}
}

customElements.define("settings-panel", SettingsPanel);
