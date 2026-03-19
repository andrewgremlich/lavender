import { login, loginWithPasskey } from "../services/auth";

export class LoginForm extends HTMLElement {
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
        .btn-secondary {
          width: 100%;
          padding: 0.75rem;
          background: transparent;
          color: var(--color-primary, #7c3aed);
          border: 2px solid var(--color-primary, #7c3aed);
          border-radius: 0.5rem;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          margin-top: 0.75rem;
          transition: background 0.2s;
        }
        .btn-secondary:hover { background: rgba(124, 58, 237, 0.05); }
        .btn-secondary:disabled { opacity: 0.6; cursor: not-allowed; }
        .divider {
          display: flex;
          align-items: center;
          margin: 1.25rem 0;
          color: var(--color-text, #6b7280);
          font-size: 0.875rem;
        }
        .divider::before, .divider::after {
          content: '';
          flex: 1;
          border-bottom: 1px solid var(--color-border, #d1d5db);
        }
        .divider span { padding: 0 0.75rem; }
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
      </style>
      <form id="login-form">
        <div class="error" id="error"></div>
        <div class="form-group">
          <label for="username">Username</label>
          <input type="text" id="username" name="username" required autocomplete="username" />
        </div>
        <div class="form-group">
          <label for="password">Password</label>
          <input type="password" id="password" name="password" required autocomplete="current-password" />
        </div>
        <button type="submit" class="btn-primary" id="login-btn">Sign In</button>
        <div class="divider"><span>or</span></div>
        <button type="button" class="btn-secondary" id="passkey-btn">Sign In with Passkey</button>
      </form>
    `;
	}

	private setupListeners() {
		const form = this.shadow.querySelector("#login-form") as HTMLFormElement;
		const passkeyBtn = this.shadow.querySelector(
			"#passkey-btn",
		) as HTMLButtonElement;

		form.addEventListener("submit", async (e: Event) => {
			e.preventDefault();
			this.clearError();

			const username = (
				this.shadow.querySelector("#username") as HTMLInputElement
			).value.trim();
			const password = (
				this.shadow.querySelector("#password") as HTMLInputElement
			).value;
			const loginBtn = this.shadow.querySelector(
				"#login-btn",
			) as HTMLButtonElement;

			if (!username || !password) {
				this.showError("All fields are required.");
				return;
			}

			try {
				loginBtn.disabled = true;
				loginBtn.innerHTML =
					'<span class="loading-spinner"></span>Signing in...';

				await login(username, password);

				window.dispatchEvent(new CustomEvent("auth-success"));
			} catch (err: unknown) {
				const message =
					err instanceof Error
						? err.message
						: "Login failed. Please check your credentials.";
				this.showError(message);
			} finally {
				loginBtn.disabled = false;
				loginBtn.textContent = "Sign In";
			}
		});

		passkeyBtn.addEventListener("click", async () => {
			this.clearError();

			const username = (
				this.shadow.querySelector("#username") as HTMLInputElement
			).value.trim();
			const password = (
				this.shadow.querySelector("#password") as HTMLInputElement
			).value;
			if (!username || !password) {
				this.showError("Username and password are required to derive your encryption key.");
				return;
			}

			try {
				passkeyBtn.disabled = true;
				passkeyBtn.innerHTML =
					'<span class="loading-spinner"></span>Authenticating...';

				await loginWithPasskey(username, password);

				window.dispatchEvent(new CustomEvent("auth-success"));
			} catch (err: unknown) {
				const message =
					err instanceof Error ? err.message : "Passkey authentication failed.";
				this.showError(message);
			} finally {
				passkeyBtn.disabled = false;
				passkeyBtn.textContent = "Sign In with Passkey";
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

customElements.define("login-form", LoginForm);
