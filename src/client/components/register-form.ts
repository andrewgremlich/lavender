import { importKey } from "../crypto/encryption.js";
import { register } from "../services/auth.js";

class RegisterForm extends HTMLElement {
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
        input:focus {
          outline: none;
          border-color: var(--color-primary, #7c3aed);
          box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.1);
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

        /* Key display styles */
        .key-display { display: none; }
        .key-display.visible { display: block; }
        .key-box {
          background: var(--color-surface, #fff);
          border: 2px solid var(--color-primary, #7c3aed);
          border-radius: 0.75rem;
          padding: 1.5rem;
          text-align: center;
        }
        .key-box h3 {
          color: var(--color-primary, #7c3aed);
          margin: 0 0 0.5rem;
          font-size: 1.125rem;
        }
        .key-warning {
          background: #fffbeb;
          border: 1px solid #f59e0b;
          color: #92400e;
          padding: 0.75rem;
          border-radius: 0.5rem;
          font-size: 0.8125rem;
          margin: 1rem 0;
          line-height: 1.5;
        }
        .key-value {
          background: #f3f4f6;
          padding: 0.75rem;
          border-radius: 0.5rem;
          font-family: monospace;
          font-size: 0.8125rem;
          word-break: break-all;
          margin: 1rem 0;
          user-select: all;
          color: var(--color-text, #1f2937);
        }
        .btn-copy {
          padding: 0.5rem 1.25rem;
          background: var(--color-primary, #7c3aed);
          color: #fff;
          border: none;
          border-radius: 0.375rem;
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
          margin-bottom: 1rem;
          transition: background 0.2s;
        }
        .btn-copy:hover { background: var(--color-primary-dark, #6d28d9); }
        .btn-copy.copied { background: #059669; }
        .acknowledge-group {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin: 1rem 0;
          justify-content: center;
        }
        .acknowledge-group label {
          font-size: 0.875rem;
          font-weight: normal;
          display: inline;
          margin: 0;
        }
        .acknowledge-group input[type="checkbox"] {
          width: auto;
          accent-color: var(--color-primary, #7c3aed);
        }
        .btn-continue {
          width: 100%;
          padding: 0.75rem;
          background: var(--color-primary, #7c3aed);
          color: #fff;
          border: none;
          border-radius: 0.5rem;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
        }
        .btn-continue:disabled { opacity: 0.4; cursor: not-allowed; }
        .btn-continue:not(:disabled):hover { background: var(--color-primary-dark, #6d28d9); }
      </style>
      <div id="register-step">
        <form id="register-form">
          <div class="error" id="error"></div>
          <div class="form-group">
            <label for="reg-username">Username</label>
            <input type="text" id="reg-username" name="username" required autocomplete="username" />
          </div>
          <div class="form-group">
            <label for="reg-password">Password</label>
            <input type="password" id="reg-password" name="password" required autocomplete="new-password" minlength="8" />
          </div>
          <div class="form-group">
            <label for="reg-confirm">Confirm Password</label>
            <input type="password" id="reg-confirm" name="confirm-password" required autocomplete="new-password" />
          </div>
          <button type="submit" class="btn-primary" id="register-btn">Create Account</button>
        </form>
      </div>
      <div id="key-step" class="key-display">
        <div class="key-box">
          <h3>Your Encryption Key</h3>
          <p style="font-size:0.875rem; color:var(--color-text-secondary, #6b7280); margin:0.25rem 0 0;">This key encrypts all your health data.</p>
          <div class="key-value" id="key-value"></div>
          <button type="button" class="btn-copy" id="copy-btn">Copy Key</button>
          <div class="key-warning">
            Save this key somewhere safe. Without it, your encrypted data cannot be recovered.
            We do not store this key and cannot reset it for you.
          </div>
          <div class="acknowledge-group">
            <input type="checkbox" id="ack-checkbox" />
            <label for="ack-checkbox">I have saved my encryption key</label>
          </div>
          <button type="button" class="btn-continue" id="continue-btn" disabled>Continue to App</button>
        </div>
      </div>
    `;
	}

	private setupListeners() {
		const form = this.shadow.querySelector("#register-form") as HTMLFormElement;
		const registerStep = this.shadow.querySelector(
			"#register-step",
		) as HTMLElement;
		const keyStep = this.shadow.querySelector("#key-step") as HTMLElement;
		const keyValueEl = this.shadow.querySelector("#key-value") as HTMLElement;
		const copyBtn = this.shadow.querySelector("#copy-btn") as HTMLButtonElement;
		const ackCheckbox = this.shadow.querySelector(
			"#ack-checkbox",
		) as HTMLInputElement;
		const continueBtn = this.shadow.querySelector(
			"#continue-btn",
		) as HTMLButtonElement;

		form.addEventListener("submit", async (e: Event) => {
			e.preventDefault();
			this.clearError();

			const username = (
				this.shadow.querySelector("#reg-username") as HTMLInputElement
			).value.trim();
			const password = (
				this.shadow.querySelector("#reg-password") as HTMLInputElement
			).value;
			const confirm = (
				this.shadow.querySelector("#reg-confirm") as HTMLInputElement
			).value;
			const registerBtn = this.shadow.querySelector(
				"#register-btn",
			) as HTMLButtonElement;

			if (!username || !password || !confirm) {
				this.showError("All fields are required.");
				return;
			}

			if (password.length < 8) {
				this.showError("Password must be at least 8 characters.");
				return;
			}

			if (password !== confirm) {
				this.showError("Passwords do not match.");
				return;
			}

			try {
				registerBtn.disabled = true;
				registerBtn.innerHTML =
					'<span class="loading-spinner"></span>Creating account...';

				const result = await register(username, password);
				const encryptionKey = result.encryptionKey;

				keyValueEl.textContent = encryptionKey;
				registerStep.style.display = "none";
				keyStep.classList.add("visible");
			} catch (err: unknown) {
				const message =
					err instanceof Error
						? err.message
						: "Registration failed. Please try again.";
				this.showError(message);
			} finally {
				const registerBtn = this.shadow.querySelector(
					"#register-btn",
				) as HTMLButtonElement;
				registerBtn.disabled = false;
				registerBtn.textContent = "Create Account";
			}
		});

		copyBtn.addEventListener("click", async () => {
			const keyText = keyValueEl.textContent || "";
			try {
				await navigator.clipboard.writeText(keyText);
				copyBtn.textContent = "Copied!";
				copyBtn.classList.add("copied");
				setTimeout(() => {
					copyBtn.textContent = "Copy Key";
					copyBtn.classList.remove("copied");
				}, 2000);
			} catch {
				// Fallback: select the text
				const range = document.createRange();
				range.selectNodeContents(keyValueEl);
				const selection = window.getSelection();
				selection?.removeAllRanges();
				selection?.addRange(range);
			}
		});

		ackCheckbox.addEventListener("change", () => {
			continueBtn.disabled = !ackCheckbox.checked;
		});

		continueBtn.addEventListener("click", async () => {
			const encryptionKey = keyValueEl.textContent || "";
			try {
				await importKey(encryptionKey);
				window.dispatchEvent(new CustomEvent("auth-success"));
			} catch {
				this.showError(
					"Failed to initialize encryption. Please try logging in with your key.",
				);
			}
		});
	}

	private showError(msg: string) {
		const errorEl = this.shadow.querySelector("#error") as HTMLElement;
		errorEl.textContent = msg;
		errorEl.classList.add("visible");
	}

	private clearError() {
		const errorEl = this.shadow.querySelector("#error") as HTMLElement;
		errorEl.textContent = "";
		errorEl.classList.remove("visible");
	}
}

customElements.define("register-form", RegisterForm);
