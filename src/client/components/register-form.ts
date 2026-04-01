import { register } from "../services/auth";

export class RegisterForm extends HTMLElement {
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
			<link rel="stylesheet" href="/styles/register-form.css">
			<div id="register-area">
				<form id="register-form">
					<div class="error" id="error"></div>
					<div class="form-group">
					<label for="reg-username">Username</label>
					<input type="text" id="reg-username" name="username" required autocomplete="username" />
					</div>
					<div class="form-group">
					<label for="reg-password">Password</label>
					<input type="password" id="reg-password" name="password" required autocomplete="new-password" minlength="12" />
					<ul class="pw-requirements" id="pw-requirements">
						<li id="req-length">At least 12 characters</li>
						<li id="req-number">At least one number</li>
						<li id="req-special">At least one special character (!@#$%^&* etc.)</li>
					</ul>
					</div>
					<div class="form-group">
					<label for="reg-confirm">Confirm Password</label>
					<input type="password" id="reg-confirm" name="confirm-password" required autocomplete="new-password" />
					</div>
					<button type="submit" class="btn-primary" id="register-btn">Create Account</button>
				</form>
				<info-panel></info-panel>
			</div>
			`;
	}

	private setupListeners() {
		const form = this.shadow.querySelector("#register-form") as HTMLFormElement;

		const passwordInput = this.shadow.querySelector(
			"#reg-password",
		) as HTMLInputElement;
		passwordInput.addEventListener("input", () => {
			this.updateRequirements(passwordInput.value);
		});

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

			if (!this.isPasswordValid(password)) {
				this.showError("Password does not meet all requirements.");
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

				const recoveryCode = await register(username, password);

				// Show the recovery code — user must acknowledge before entering the app
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
			} catch (err: unknown) {
				const message =
					err instanceof Error
						? err.message
						: "Registration failed. Please try again.";
				this.showError(message);
			} finally {
				registerBtn.disabled = false;
				registerBtn.textContent = "Create Account";
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

customElements.define("register-form", RegisterForm);
