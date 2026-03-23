import { login } from "../services/auth";

export class LoginForm extends HTMLElement {
	private shadow: ShadowRoot;

	constructor() {
		super();
		this.shadow = this.attachShadow({ mode: "open" });
	}

	connectedCallback() {
		this.render();
	}

	private render() {
		this.shadow.innerHTML = `
      <link rel="stylesheet" href="/styles/main.css">
      <style>
        :host { 
          display: block;
        }
          
        #login-form {
          margin: auto;
          max-width: 400px;
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
      </form>
    `;
		this.setupListeners();
	}

	private setupListeners() {
		const form = this.shadow.querySelector("#login-form") as HTMLFormElement;

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
	}

	private showError(msg: string) {
		const errorEl = this.shadow.querySelector("#error") as HTMLElement;
		if (!errorEl) return;
		errorEl.textContent = msg;
		errorEl.classList.add("visible");
	}

	private clearError() {
		const errorEl = this.shadow.querySelector("#error") as HTMLElement;
		if (!errorEl) return;
		errorEl.textContent = "";
		errorEl.classList.remove("visible");
	}
}

customElements.define("login-form", LoginForm);
