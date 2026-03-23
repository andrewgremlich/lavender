import {
	Circle,
	CircleDot,
	CirclePlus,
	Droplet,
	Droplets,
	Egg,
	House,
	Info,
	LogOut,
	Minus,
	Save,
	Settings,
	createElement,
	type IconNode,
} from "lucide";

const ICON_MAP: Record<string, IconNode> = {
	circle: Circle,
	"circle-dot": CircleDot,
	"circle-plus": CirclePlus,
	droplet: Droplet,
	droplets: Droplets,
	egg: Egg,
	house: House,
	info: Info,
	"log-out": LogOut,
	minus: Minus,
	save: Save,
	settings: Settings,
};

/**
 * Replace all `[data-icon]` elements within a root with their corresponding
 * Lucide SVG icons. Works with both Shadow DOM and regular DOM roots.
 */
export function renderIcons(root: ShadowRoot | HTMLElement): void {
	root.querySelectorAll<HTMLElement>("[data-icon]").forEach((el) => {
		const name = el.dataset.icon;
		if (!name) return;
		const icon = ICON_MAP[name];
		if (!icon) return;
		el.replaceChildren(createElement(icon));
	});
}
