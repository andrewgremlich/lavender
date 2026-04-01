import { login, setupRecovery } from "../services/auth";

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
      <link rel="stylesheet" href="/styles/login-form.css">
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
        <a id="forgot-link" href="#/recovery" style="display:block;text-align:center;margin-top:0.75rem;font-size:0.875rem;color:var(--color-primary,#7c3aed);">Forgot your password?</a>
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
				const hasRecovery = await login(username, password);

				if (!hasRecovery) {
					// Existing account without a recovery code — set one up now
					await this.promptRecoverySetup();
				} else {
					window.dispatchEvent(new CustomEvent("auth-success"));
				}
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

	/**
	 * Called for existing users who don't have a recovery code yet.
	 * Generates one, wraps the current session key, stores it, and shows the code.
	 */
	private async promptRecoverySetup(): Promise<void> {
		const recoveryCode = await setupRecovery();

		const display = document.createElement("recovery-code-display");
		display.setAttribute("code", recoveryCode);
		document.body.appendChild(display);

		window.addEventListener(
			"recovery-code-acknowledged",
			() => {
				display.remove();
				window.dispatchEvent(new CustomEvent("auth-success"));
			},
			{ once: true },
		);
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
