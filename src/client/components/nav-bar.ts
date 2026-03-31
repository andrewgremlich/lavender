import { currentRoute, navigate } from "../router";
import { logout } from "../services/auth";
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
	}

	disconnectedCallback() {
		window.removeEventListener("hashchange", () => this.updateActiveState());
	}

	private render() {
		const route = currentRoute();

		this.shadow.innerHTML = `
      <link rel="stylesheet" href="/styles/main.css">
      <link rel="stylesheet" href="/styles/nav-bar.css">

      <nav>
        <div class="nav-brand">
          <h1>Lavender</h1>
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
