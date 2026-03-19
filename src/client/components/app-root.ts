import { navigate, route, startRouter } from "../router.js";
import { isLoggedIn } from "@client/services/auth";

class AppRoot extends HTMLElement {
	private shadow: ShadowRoot;

	constructor() {
		super();
		this.shadow = this.attachShadow({ mode: "open" });
	}

	connectedCallback() {
		this.render();
		this.setupRouting();
		this.setupEventListeners();
	}

	private setupEventListeners() {
		window.addEventListener("auth-success", () => {
			this.render();
			this.setupRouting();
			navigate("/");
		});

		window.addEventListener("user-logout", () => {
			this.render();
		});
	}

	private setupRouting() {
		if (!isLoggedIn()) return;

		const content = this.shadow.querySelector("#content");
		if (!content) return;

		route("/", () => {
			content.innerHTML = "<metric-chart></metric-chart>";
		});
		route("/entry", () => {
			content.innerHTML = "<data-entry-form></data-entry-form>";
		});
		route("/settings", () => {
			content.innerHTML = "<settings-panel></settings-panel>";
		});

		startRouter();
	}

	private render() {
		if (isLoggedIn()) {
			this.shadow.innerHTML = `
        <link rel="stylesheet" href="/styles/main.css">
        <style>
          :host { display: block; min-height: 100vh; background: var(--color-bg, #faf5ff); }
          .app-layout { display: flex; flex-direction: column; min-height: 100vh; }
          .content { flex: 1; padding: 1rem; padding-bottom: 5rem; max-width: 800px; margin: 0 auto; width: 100%; box-sizing: border-box; }
          @media (min-width: 768px) { .content { padding: 2rem; padding-bottom: 2rem; } }
          @media (min-width: 1024px) {
            .app-layout { flex-direction: row; }
            .content { padding: 2rem; }
          }
        </style>
        <div class="app-layout">
          <nav-bar></nav-bar>
          <main class="content" id="content"></main>
        </div>
      `;
		} else {
			this.shadow.innerHTML = `
        <link rel="stylesheet" href="/styles/main.css">
        <style>
          :host { display: flex; align-items: center; justify-content: center; min-height: 100vh; background: var(--color-bg, #faf5ff); }
          .auth-container { width: 100%; max-width: 400px; padding: 1rem; }
          .auth-toggle { text-align: center; margin-top: 1rem; color: var(--color-text-secondary, #6b7280); }
          .auth-toggle a { color: var(--color-primary, #7c3aed); cursor: pointer; text-decoration: underline; }
          .app-title { text-align: center; margin-bottom: 2rem; }
          .app-title h1 { font-size: 2rem; color: var(--color-primary, #7c3aed); margin: 0; }
          .app-title p { color: var(--color-text-secondary, #6b7280); margin: 0.5rem 0 0; }
        </style>
        <div class="auth-container">
          <div class="app-title">
            <h1>Lavendar</h1>
            <p>Private Health Tracking</p>
          </div>
          <login-form id="login-view"></login-form>
          <register-form id="register-view" style="display:none"></register-form>
          <div class="auth-toggle">
            <span id="toggle-text">Don't have an account? </span>
            <a id="auth-toggle">Sign up</a>
          </div>
        </div>
      `;

			const toggle = this.shadow.querySelector("#auth-toggle");
			const loginView = this.shadow.querySelector(
				"#login-view",
			) as HTMLElement | null;
			const registerView = this.shadow.querySelector(
				"#register-view",
			) as HTMLElement | null;
			const toggleText = this.shadow.querySelector("#toggle-text");

			let showingLogin = true;
			toggle?.addEventListener("click", () => {
				showingLogin = !showingLogin;
				if (loginView) loginView.style.display = showingLogin ? "" : "none";
				if (registerView)
					registerView.style.display = showingLogin ? "none" : "";
				if (toggle) toggle.textContent = showingLogin ? "Sign up" : "Sign in";
				if (toggleText)
					toggleText.textContent = showingLogin
						? "Don't have an account? "
						: "Already have an account? ";
			});
		}
	}
}

customElements.define("app-root", AppRoot);
