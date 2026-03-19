import { currentRoute, navigate } from "../router.js";
import { logout } from "../services/auth.js";

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
          color: var(--color-text-secondary, #9ca3af);
          cursor: pointer;
          text-decoration: none;
          transition: color 0.2s;
          border-radius: 0.5rem;
          -webkit-tap-highlight-color: transparent;
        }
        .nav-item:hover { color: var(--color-primary, #7c3aed); }
        .nav-item.active { color: var(--color-primary, #7c3aed); }
        .nav-item svg { width: 24px; height: 24px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
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

        .nav-item.logout { color: #dc2626; }
        .nav-item.logout:hover { color: #b91c1c; }
        @media (min-width: 1024px) {
          .nav-item.logout { margin-top: auto; }
        }
      </style>

      <nav>
        <div class="nav-brand">
          <h1>Lavendar</h1>
        </div>

        <button class="nav-item ${route === "/" ? "active" : ""}" data-route="/">
          <svg viewBox="0 0 24 24">
            <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z" />
          </svg>
          <span class="nav-label">Dashboard</span>
        </button>

        <button class="nav-item ${route === "/entry" ? "active" : ""}" data-route="/entry">
          <svg viewBox="0 0 24 24">
            <path d="M12 4v16m8-8H4" />
          </svg>
          <span class="nav-label">Add Entry</span>
        </button>

        <button class="nav-item ${route === "/settings" ? "active" : ""}" data-route="/settings">
          <svg viewBox="0 0 24 24">
            <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.573-1.066z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <span class="nav-label">Settings</span>
        </button>

        <div class="nav-spacer"></div>

        <button class="nav-item logout" id="logout-btn">
          <svg viewBox="0 0 24 24">
            <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span class="nav-label">Log Out</span>
        </button>
      </nav>
    `;
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
