import { navigate, route, startRouter } from "@client/router";
import { isLoggedIn } from "@client/services/auth";
import { syncEngine } from "@client/services/sync-engine";

import "./components/login-form";
import "./components/register-form";
import "./components/recovery-code-display";
import "./components/recovery-form";
import "./components/data-entry-form";
import "./components/metric-chart";
import "./components/settings-panel";
import "./components/nav-bar";
import "./components/info-panel";
import "./components/entry-card";
import "./components/cycle-calendar";

if ("serviceWorker" in navigator) {
	navigator.serviceWorker.register("/sw.js").catch((err) => {
		console.warn("Service worker registration failed:", err);
	});
}

syncEngine.init();

function getAppRoot(): HTMLElement {
	return document.getElementById("app-root") as HTMLElement;
}

function setupRouting() {
	if (!isLoggedIn()) return;

	const content = document.getElementById("content");
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

function renderApp() {
	const appRoot = getAppRoot();

	if (isLoggedIn()) {
		appRoot.classList.remove("auth");
		appRoot.innerHTML = `
			<div class="app-layout">
				<nav-bar></nav-bar>
				<main class="content" id="content"></main>
			</div>
		`;
		setupRouting();
	} else if (window.location.hash === "#/recovery") {
		appRoot.classList.add("auth");
		appRoot.innerHTML = `
			<div class="auth-container">
				<div class="app-title">
					<img src="/logo-512x512.png" />
					<div>
						<h1>Lavender</h1>
						<p>Private Health Tracking</p>
					</div>
				</div>
				<recovery-form></recovery-form>
			</div>
		`;
		const onHashChange = () => {
			if (!isLoggedIn()) renderApp();
		};
		window.addEventListener("hashchange", onHashChange, { once: true });
	} else {
		appRoot.classList.add("auth");
		appRoot.innerHTML = `
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

		const toggle = document.getElementById("auth-toggle");
		const loginView = document.getElementById("login-view");
		const registerView = document.getElementById("register-view");
		const toggleText = document.getElementById("toggle-text");

		const applyAuthView = (showingLogin: boolean) => {
			if (loginView) loginView.style.display = showingLogin ? "" : "none";
			if (registerView) registerView.style.display = showingLogin ? "none" : "";
			if (toggle) toggle.textContent = showingLogin ? "Sign up" : "Sign in";
			if (toggleText)
				toggleText.textContent = showingLogin
					? "Don't have an account? "
					: "Already have an account? ";
		};

		const isRegisterHash = () => window.location.hash === "#register";

		applyAuthView(!isRegisterHash());

		const onHashChange = () => {
			if (!isLoggedIn()) {
				if (window.location.hash === "#/recovery") {
					renderApp();
				} else {
					applyAuthView(!isRegisterHash());
				}
			}
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

window.addEventListener("auth-success", () => {
	renderApp();
	navigate("/");
});

window.addEventListener("user-logout", () => {
	renderApp();
});

renderApp();
