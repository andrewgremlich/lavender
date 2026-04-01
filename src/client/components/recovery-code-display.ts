/**
 * <recovery-code-display code="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX">
 *
 * Full-screen overlay that shows the recovery code and requires the user
 * to acknowledge they have saved it before continuing.
 *
 * Dispatches "recovery-code-acknowledged" on window when the user confirms.
 */
export class RecoveryCodeDisplay extends HTMLElement {
	private shadow: ShadowRoot;

	constructor() {
		super();
		this.shadow = this.attachShadow({ mode: "open" });
	}

	connectedCallback() {
		this.render();
	}

	private get code(): string {
		return this.getAttribute("code") ?? "";
	}

	private render() {
		this.shadow.innerHTML = `
      <style>
        :host { display: block; }
        .overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 1rem;
          box-sizing: border-box;
        }
        .card {
          background: var(--color-surface, #fff);
          border-radius: 1rem;
          padding: 2rem;
          max-width: 480px;
          width: 100%;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }
        h2 {
          margin: 0 0 0.5rem;
          font-size: 1.25rem;
          color: var(--color-text, #1f2937);
        }
        .warning {
          background: #fef3c7;
          border: 1px solid #f59e0b;
          border-radius: 0.5rem;
          padding: 0.75rem 1rem;
          font-size: 0.875rem;
          color: #92400e;
          margin-bottom: 1.5rem;
          line-height: 1.5;
        }
        .code-box {
          background: var(--color-bg, #f9fafb);
          border: 2px solid var(--color-primary, #7c3aed);
          border-radius: 0.5rem;
          padding: 1rem;
          text-align: center;
          font-family: monospace;
          font-size: 1.1rem;
          font-weight: 700;
          letter-spacing: 0.05em;
          color: var(--color-text, #1f2937);
          margin-bottom: 1rem;
          word-break: break-all;
        }
        .btn-row {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1.5rem;
        }
        .btn-secondary {
          flex: 1;
          padding: 0.6rem;
          background: var(--color-surface, #fff);
          color: var(--color-primary, #7c3aed);
          border: 1px solid var(--color-primary, #7c3aed);
          border-radius: 0.5rem;
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }
        .btn-secondary:hover {
          background: var(--color-primary-light, #ede9fe);
        }
        .acknowledge {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          margin-bottom: 1.5rem;
          font-size: 0.875rem;
          color: var(--color-text, #374151);
          cursor: pointer;
        }
        .acknowledge input[type="checkbox"] {
          width: 1.1rem;
          height: 1.1rem;
          flex-shrink: 0;
          margin-top: 0.1rem;
          accent-color: var(--color-primary, #7c3aed);
          cursor: pointer;
        }
        .btn-primary {
          width: 100%;
          padding: 0.75rem;
          background: var(--color-primary, #7c3aed);
          color: #fff;
          border: none;
          border-radius: 0.5rem;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }
        .btn-primary:hover { background: var(--color-primary-dark, #6d28d9); }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
        .copy-feedback {
          font-size: 0.75rem;
          color: #16a34a;
          text-align: center;
          min-height: 1rem;
          margin-bottom: 0.25rem;
        }
      </style>
      <div class="overlay">
        <div class="card">
          <h2>Save your recovery code</h2>
          <div class="warning">
            <strong>Important:</strong> If you forget your password, this recovery code is the
            only way to access your data. It cannot be shown again. Store it somewhere safe —
            a password manager, printed paper, or secure notes app.
          </div>
          <div class="code-box" id="code-text">${this.code}</div>
          <div class="copy-feedback" id="copy-feedback"></div>
          <div class="btn-row">
            <button class="btn-secondary" id="copy-btn">Copy</button>
            <button class="btn-secondary" id="download-btn">Download .txt</button>
          </div>
          <label class="acknowledge">
            <input type="checkbox" id="ack-checkbox" />
            <span>I have saved my recovery code in a safe place and understand I cannot recover it if lost.</span>
          </label>
          <button class="btn-primary" id="continue-btn" disabled>Continue</button>
        </div>
      </div>
    `;

		this.setupListeners();
	}

	private setupListeners() {
		const checkbox = this.shadow.querySelector(
			"#ack-checkbox",
		) as HTMLInputElement;
		const continueBtn = this.shadow.querySelector(
			"#continue-btn",
		) as HTMLButtonElement;
		const copyBtn = this.shadow.querySelector("#copy-btn") as HTMLButtonElement;
		const downloadBtn = this.shadow.querySelector(
			"#download-btn",
		) as HTMLButtonElement;
		const copyFeedback = this.shadow.querySelector(
			"#copy-feedback",
		) as HTMLElement;

		checkbox.addEventListener("change", () => {
			continueBtn.disabled = !checkbox.checked;
		});

		continueBtn.addEventListener("click", () => {
			window.dispatchEvent(new CustomEvent("recovery-code-acknowledged"));
		});

		copyBtn.addEventListener("click", async () => {
			try {
				await navigator.clipboard.writeText(this.code);
				copyFeedback.textContent = "Copied to clipboard!";
				setTimeout(() => {
					copyFeedback.textContent = "";
				}, 2000);
			} catch {
				copyFeedback.textContent = "Copy failed — please copy manually.";
			}
		});

		downloadBtn.addEventListener("click", () => {
			const content = `Lavender Recovery Code\n\n${this.code}\n\nStore this somewhere safe. If you lose this code and forget your password, your data cannot be recovered.\n`;
			const blob = new Blob([content], { type: "text/plain" });
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = "lavender-recovery-code.txt";
			a.click();
			URL.revokeObjectURL(url);
		});
	}
}

customElements.define("recovery-code-display", RecoveryCodeDisplay);
