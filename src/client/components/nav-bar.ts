import { currentRoute, navigate } from "../router";
import { logout } from "../services/auth";
import { metricsStore } from "../services/metrics-store";
import type { SyncStatus } from "../services/sync-engine";
import { renderIcons } from "../utils/icons";

class NavBar extends HTMLElement {
	private shadow: ShadowRoot;

	constructor() {
		super();
		this.shadow = this.attachShadow({ mode: "open" });
	}

	connectedCallback() {
		this.render();
		this.setupListeners();
		window.addEventListener("hashchange", () => this.updateActiveState());
		window.addEventListener("sync-status-change", this._onSyncStatus);
		// Set initial dot state from queue
		metricsStore.getQueue().then((q) => {
			if (q.length > 0) this.updateSyncDot("pending");
		});
	}

	disconnectedCallback() {
		window.removeEventListener("hashchange", () => this.updateActiveState());
		window.removeEventListener("sync-status-change", this._onSyncStatus);
	}

	private _onSyncStatus = (e: Event) => {
		const status = (e as CustomEvent<{ status: SyncStatus }>).detail.status;
		this.updateSyncDot(status);
	};

	private updateSyncDot(status: SyncStatus) {
		const dot = this.shadow.querySelector("#sync-dot") as HTMLElement | null;
		if (!dot) return;
		dot.className = `sync-dot sync-dot--${status}`;
		dot.title =
			status === "synced"
				? "All changes saved"
				: status === "pending"
					? "Syncing changes..."
					: "Sync error — will retry when online";
	}

	private render() {
		const route = currentRoute();

		this.shadow.innerHTML = `
      <link rel="stylesheet" href="/styles/main.css">
      <link rel="stylesheet" href="/styles/nav-bar.css">

      <nav>
        <div class="nav-brand">
			<h1>Lavender</h1>
			<span id="sync-dot" class="sync-dot sync-dot--synced" title="All changes saved"></span>
        </div>

        <button class="nav-item ${route === "/" ? "active" : ""}" data-route="/">
          <span class="icon" data-icon="house"></span>
          <span class="nav-label">Dashboard</span>
        </button>

        <button class="nav-item ${route === "/entry" ? "active" : ""}" data-route="/entry">
          <span class="icon" data-icon="circle-plus"></span>
          <span class="nav-label">Add Entry</span>
        </button>

        <button class="nav-item ${route === "/analytics" ? "active" : ""}" data-route="/analytics">
          <span class="icon" data-icon="trending-up"></span>
          <span class="nav-label">Analytics</span>
        </button>

        <button class="nav-item ${route === "/settings" ? "active" : ""}" data-route="/settings">
          <span class="icon" data-icon="settings"></span>
          <span class="nav-label">Settings</span>
        </button>

        <div class="nav-spacer"></div>

        <button class="nav-item ${route === "/info" ? "active" : ""}" data-route="/info">
          <span class="icon" data-icon="info"></span>
          <span class="nav-label">Info</span>
        </button>

        <button class="nav-item logout" id="logout-btn">
          <span class="icon" data-icon="log-out"></span>
          <span class="nav-label">Log Out</span>
        </button>
      </nav>
    `;

		renderIcons(this.shadow);
	}

	private setupListeners() {
		this.shadow.querySelectorAll(".nav-item[data-route]").forEach((btn) => {
			btn.addEventListener("click", () => {
				const route = (btn as HTMLElement).dataset.route;
				if (route) navigate(route);
			});
		});

		this.shadow
			.querySelector("#logout-btn")
			?.addEventListener("click", async () => {
				await metricsStore.clearCache();
				logout();
				window.dispatchEvent(new CustomEvent("user-logout"));
			});
	}

	private updateActiveState() {
		const route = currentRoute();
		this.shadow.querySelectorAll(".nav-item").forEach((btn) => {
			const btnRoute = (btn as HTMLElement).dataset.route;
			btn.classList.toggle("active", btnRoute === route);
		});
	}
}

customElements.define("nav-bar", NavBar);
