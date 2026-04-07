import { recover } from "../services/auth";

/**
 * <recovery-form> — shown at #/recovery when the user is not logged in.
 * Accepts username + recovery code + new password, re-encrypts all data,
 * then shows the new rotated recovery code before navigating to the app.
 */
export class RecoveryForm extends HTMLElement {
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
		this.shadow.innerHTML = `
      <link rel="stylesheet" href="/styles/main.css">
      <style>
        :host { display: block; }
        #recovery-form {
          margin: auto;
          max-width: 420px;
        }
        h2 {
          margin: 0 0 0.25rem;
          font-size: 1.25rem;
          color: var(--color-text, #1f2937);
        }
        .subtitle {
          font-size: 0.875rem;
          color: var(--color-text-muted, #6b7280);
          margin-bottom: 1.5rem;
        }
        .form-group { margin-bottom: 1rem; }
        label {
          display: block;
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--color-text, #1f2937);
          margin-bottom: 0.25rem;
        }
        input {
          width: 100%;
          padding: 0.75rem;
          border: 1px solid var(--color-border, #d1d5db);
          border-radius: 0.5rem;
          font-size: 1rem;
          background: var(--color-surface, #fff);
          color: var(--color-text, #1f2937);
          box-sizing: border-box;
          transition: border-color 0.2s;
        }
        #recovery-code-input { font-family: monospace; letter-spacing: 0.05em; }
        input:focus {
          outline: none;
          border-color: var(--color-primary, #7c3aed);
          box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.1);
        }
        .pw-requirements {
          margin-top: 0.5rem;
          padding: 0.625rem 0.75rem;
          background: var(--color-surface, #f9fafb);
          border: 1px solid var(--color-border, #e5e7eb);
          border-radius: 0.5rem;
          list-style: none;
          font-size: 0.8125rem;
          color: var(--color-text, #6b7280);
        }
        .pw-requirements li {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.125rem 0;
        }
        .pw-requirements li::before {
          content: "\\2715";
          color: #dc2626;
          font-weight: 600;
          font-size: 0.75rem;
          width: 1rem;
          text-align: center;
          flex-shrink: 0;
        }
        .pw-requirements li.met::before { content: "\\2713"; color: #16a34a; }
        .pw-requirements li.met { color: var(--color-text, #374151); }
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
          margin-top: 0.5rem;
        }
        .btn-primary:hover { background: var(--color-primary-dark, #6d28d9); }
        .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
        .error {
          background: #fef2f2;
          color: #dc2626;
          padding: 0.75rem;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          margin-bottom: 1rem;
          display: none;
        }
        .error.visible { display: block; }
        .progress {
          background: #ede9fe;
          color: #5b21b6;
          padding: 0.75rem;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          margin-bottom: 1rem;
          display: none;
        }
        .progress.visible { display: block; }
        .back-link {
          display: block;
          text-align: center;
          margin-top: 1rem;
          font-size: 0.875rem;
          color: var(--color-primary, #7c3aed);
          cursor: pointer;
          background: none;
          border: none;
          padding: 0;
          text-decoration: underline;
        }
        .loading-spinner {
          display: inline-block;
          width: 1rem;
          height: 1rem;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
          margin-right: 0.5rem;
          vertical-align: middle;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      </style>
      <form id="recovery-form">
        <h2>Password Recovery</h2>
        <p class="subtitle">Enter your recovery code to set a new password. Your data will be re-encrypted automatically.</p>
        <div class="error" id="error"></div>
        <div class="progress" id="progress"></div>
        <div class="form-group">
          <label for="recovery-username">Username</label>
          <input type="text" id="recovery-username" name="username" required autocomplete="username" />
        </div>
        <div class="form-group">
          <label for="recovery-code-input">Recovery Code</label>
          <input type="text" id="recovery-code-input" name="recovery-code"
            required autocomplete="off" spellcheck="false"
            placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" />
        </div>
        <div class="form-group">
          <label for="new-password">New Password</label>
          <input type="password" id="new-password" name="new-password" required autocomplete="new-password" />
          <ul class="pw-requirements" id="pw-requirements">
            <li id="req-length">At least 12 characters</li>
            <li id="req-number">At least one number</li>
            <li id="req-special">At least one special character (!@#$%^&* etc.)</li>
          </ul>
        </div>
        <div class="form-group">
          <label for="confirm-password">Confirm New Password</label>
          <input type="password" id="confirm-password" name="confirm-password" required autocomplete="new-password" />
        </div>
        <button type="submit" class="btn-primary" id="recover-btn">Recover Account</button>
        <button type="button" class="back-link" id="back-btn">Back to sign in</button>
      </form>
    `;
	}

	private setupListeners() {
		const form = this.shadow.querySelector("#recovery-form") as HTMLFormElement;
		const passwordInput = this.shadow.querySelector(
			"#new-password",
		) as HTMLInputElement;

		passwordInput.addEventListener("input", () => {
			this.updateRequirements(passwordInput.value);
		});

		const backBtn = this.shadow.querySelector("#back-btn") as HTMLButtonElement;
		backBtn.addEventListener("click", () => {
			window.location.hash = "";
		});

		form.addEventListener("submit", async (e: Event) => {
			e.preventDefault();
			this.clearError();

			const username = (
				this.shadow.querySelector("#recovery-username") as HTMLInputElement
			).value.trim();
			const recoveryCode = (
				this.shadow.querySelector("#recovery-code-input") as HTMLInputElement
			).value.trim();
			const newPassword = (
				this.shadow.querySelector("#new-password") as HTMLInputElement
			).value;
			const confirmPassword = (
				this.shadow.querySelector("#confirm-password") as HTMLInputElement
			).value;
			const recoverBtn = this.shadow.querySelector(
				"#recover-btn",
			) as HTMLButtonElement;

			if (!username || !recoveryCode || !newPassword || !confirmPassword) {
				this.showError("All fields are required.");
				return;
			}

			// Validate recovery code format (32 hex chars, ignoring dashes/spaces)
			const normalized = recoveryCode.replace(/[\s-]/g, "");
			if (!/^[0-9A-Fa-f]{32}$/.test(normalized)) {
				this.showError(
					"Recovery code must be 32 hex characters (e.g. XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX).",
				);
				return;
			}

			if (!this.isPasswordValid(newPassword)) {
				this.showError("New password does not meet all requirements.");
				return;
			}

			if (newPassword !== confirmPassword) {
				this.showError("Passwords do not match.");
				return;
			}

			try {
				recoverBtn.disabled = true;
				recoverBtn.innerHTML =
					'<span class="loading-spinner"></span>Recovering account...';
				this.showProgress(
					"Verifying recovery code and re-encrypting your data. This may take a moment...",
				);

				const newRecoveryCode = await recover(
					username,
					recoveryCode,
					newPassword,
				);

				this.hideProgress();

				// Show the new rotated recovery code — user must acknowledge before continuing
				const display = document.createElement("recovery-code-display");
				display.setAttribute("code", newRecoveryCode);
				document.body.appendChild(display);

				window.addEventListener(
					"recovery-code-acknowledged",
					() => {
						display.remove();
						window.dispatchEvent(new CustomEvent("auth-success"));
					},
					{ once: true },
				);
			} catch (err: unknown) {
				this.hideProgress();
				const message =
					err instanceof Error
						? err.message
						: "Recovery failed. Please try again.";
				this.showError(message);
				recoverBtn.disabled = false;
				recoverBtn.textContent = "Recover Account";
			}
		});
	}

	private showError(msg: string) {
		const el = this.shadow.querySelector("#error") as HTMLElement;
		el.textContent = msg;
		el.classList.add("visible");
	}

	private clearError() {
		const el = this.shadow.querySelector("#error") as HTMLElement;
		el.textContent = "";
		el.classList.remove("visible");
	}

	private showProgress(msg: string) {
		const el = this.shadow.querySelector("#progress") as HTMLElement;
		el.textContent = msg;
		el.classList.add("visible");
	}

	private hideProgress() {
		const el = this.shadow.querySelector("#progress") as HTMLElement;
		el.textContent = "";
		el.classList.remove("visible");
	}

	private isPasswordValid(password: string): boolean {
		return (
			password.length >= 12 &&
			/\d/.test(password) &&
			/[^a-zA-Z0-9]/.test(password)
		);
	}

	private updateRequirements(password: string) {
		const reqs: Array<{ id: string; met: boolean }> = [
			{ id: "req-length", met: password.length >= 12 },
			{ id: "req-number", met: /\d/.test(password) },
			{ id: "req-special", met: /[^a-zA-Z0-9]/.test(password) },
		];
		for (const { id, met } of reqs) {
			const el = this.shadow.querySelector(`#${id}`);
			el?.classList.toggle("met", met);
		}
	}
}

customElements.define("recovery-form", RecoveryForm);
