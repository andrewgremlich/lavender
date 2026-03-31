import { navigate, route, startRouter } from "@client/router";
import { isLoggedIn } from "@client/services/auth";

import type { LoginForm } from "./login-form";
import type { RegisterForm } from "./register-form";

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
		route("/info", () => {
			content.innerHTML = "<info-panel></info-panel>";
		});

		startRouter();
	}

	private render() {
		if (isLoggedIn()) {
			this.classList.remove("auth");
			this.shadow.innerHTML = `
        <link rel="stylesheet" href="/styles/main.css">
        <link rel="stylesheet" href="/styles/app-root.css">
        <div class="app-layout">
          <nav-bar></nav-bar>
          <main class="content" id="content"></main>
        </div>
      `;
		} else {
			this.classList.add("auth");
			this.shadow.innerHTML = `
				<link rel="stylesheet" href="/styles/main.css">
				<link rel="stylesheet" href="/styles/app-root.css">
				<div class="auth-container">
				<div class="app-title">
					<img src="/logo-512x512.png" />
					<div>
						<h1>Lavender</h1>
						<p>Private Health Tracking</p>
					</div>
				</div>
				<div class="auth-toggle">
					<span id="toggle-text">Don't have an account? </span>
					<a id="auth-toggle">Sign up</a>
				</div>
				<login-form id="login-view"></login-form>
				<register-form id="register-view" style="display:none"></register-form>
				</div>
			`;

			const toggle = this.shadow.querySelector("#auth-toggle");
			const loginView = this.shadow.querySelector(
				"#login-view",
			) as LoginForm | null;
			const registerView = this.shadow.querySelector(
				"#register-view",
			) as RegisterForm | null;
			const toggleText = this.shadow.querySelector("#toggle-text");

			const applyAuthView = (showingLogin: boolean) => {
				if (loginView) loginView.style.display = showingLogin ? "" : "none";
				if (registerView)
					registerView.style.display = showingLogin ? "none" : "";
				if (toggle) toggle.textContent = showingLogin ? "Sign up" : "Sign in";
				if (toggleText)
					toggleText.textContent = showingLogin
						? "Don't have an account? "
						: "Already have an account? ";
			};

			const isRegisterHash = () => window.location.hash === "#register";

			applyAuthView(!isRegisterHash());

			const onHashChange = () => {
				if (!isLoggedIn()) applyAuthView(!isRegisterHash());
			};
			window.addEventListener("hashchange", onHashChange);

			toggle?.addEventListener("click", () => {
				if (isRegisterHash()) {
					history.back();
				} else {
					history.pushState(null, "", "#register");
					applyAuthView(false);
				}
			});
		}
	}
}

customElements.define("app-root", AppRoot);
