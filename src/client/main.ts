import "./components/app-root";
import "./components/login-form";
import "./components/register-form";
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
