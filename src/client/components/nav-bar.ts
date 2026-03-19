import { createElement, House, CirclePlus, Settings, LogOut } from "lucide";
import { currentRoute, navigate } from "../router";
import { logout } from "../services/auth";

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
	}

	disconnectedCallback() {
		window.removeEventListener("hashchange", () => this.updateActiveState());
	}

	private render() {
		const route = currentRoute();

		this.shadow.innerHTML = `
      <link rel="stylesheet" href="/styles/main.css">
      <style>
        :host { display: block; }

        /* Mobile: bottom nav */
        nav {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          background: var(--color-surface, #fff);
          border-top: 1px solid var(--color-border, #e5e7eb);
          display: flex;
          justify-content: space-around;
          align-items: center;
          padding: 0.5rem 0;
          padding-bottom: calc(0.5rem + env(safe-area-inset-bottom, 0px));
          z-index: 100;
          box-shadow: 0 -2px 10px rgba(0,0,0,0.05);
        }

        .nav-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.25rem;
          padding: 0.25rem 0.75rem;
          border: none;
          background: transparent;
          color: var(--color-text, #9ca3af);
          cursor: pointer;
          text-decoration: none;
          transition: color 0.2s;
          border-radius: 0.5rem;
          -webkit-tap-highlight-color: transparent;
        }
        .nav-item:hover { color: var(--color-primary, #7c3aed); }
        .nav-item.active { color: var(--color-primary, #7c3aed); }
        .nav-item svg { width: 24px; height: 24px; }
        .icon { display: flex; align-items: center; justify-content: center; }
        .nav-label { font-size: 0.6875rem; font-weight: 500; }

        /* Desktop: left sidebar */
        @media (min-width: 1024px) {
          nav {
            position: fixed;
            flex-direction: column;
            justify-content: flex-start;
            align-items: stretch;
            width: 220px;
            min-height: 100vh;
            border-top: none;
            border-right: 1px solid var(--color-border, #e5e7eb);
            padding: 1.5rem 0.75rem;
            box-shadow: none;
            flex-shrink: 0;
          }

          .nav-brand {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0 0.75rem;
            margin-bottom: 2rem;
          }
          .nav-brand h1 {
            font-size: 1.25rem;
            color: var(--color-primary, #7c3aed);
            margin: 0;
          }

          .nav-item {
            flex-direction: row;
            justify-content: flex-start;
            gap: 0.75rem;
            padding: 0.625rem 0.75rem;
            margin-bottom: 0.25rem;
          }
          .nav-item.active {
            background: rgba(124, 58, 237, 0.08);
          }
          .nav-label { font-size: 0.875rem; }
        }

        /* Hide brand on mobile */
        .nav-brand { display: none; }
        @media (min-width: 1024px) { .nav-brand { display: flex; } }

        .nav-spacer { flex: 1; }

        .nav-item.logout { color: var(--color-text); }
        @media (min-width: 1024px) {
          .nav-item.logout { margin-top: auto; }
        }
      </style>

      <nav>
        <div class="nav-brand">
          <h1>Lavendar</h1>
        </div>

        <button class="nav-item ${route === "/" ? "active" : ""}" data-route="/">
          <span class="icon" data-icon="house"></span>
          <span class="nav-label">Dashboard</span>
        </button>

        <button class="nav-item ${route === "/entry" ? "active" : ""}" data-route="/entry">
          <span class="icon" data-icon="circle-plus"></span>
          <span class="nav-label">Add Entry</span>
        </button>

        <button class="nav-item ${route === "/settings" ? "active" : ""}" data-route="/settings">
          <span class="icon" data-icon="settings"></span>
          <span class="nav-label">Settings</span>
        </button>

        <div class="nav-spacer"></div>

        <button class="nav-item logout" id="logout-btn">
          <span class="icon" data-icon="log-out"></span>
          <span class="nav-label">Log Out</span>
        </button>
      </nav>
    `;

		const iconMap: Record<string, Parameters<typeof createElement>[0]> = {
			"house": House,
			"circle-plus": CirclePlus,
			"settings": Settings,
			"log-out": LogOut,
		};

		this.shadow.querySelectorAll<HTMLElement>(".icon[data-icon]").forEach((el) => {
			const icon = iconMap[el.dataset.icon ?? ""];
			if (icon) el.appendChild(createElement(icon));
		});
	}

	private setupListeners() {
		this.shadow.querySelectorAll(".nav-item[data-route]").forEach((btn) => {
			btn.addEventListener("click", () => {
				const route = (btn as HTMLElement).dataset.route;
				if (route) navigate(route);
			});
		});

		this.shadow.querySelector("#logout-btn")?.addEventListener("click", () => {
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
