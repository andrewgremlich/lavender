type RouteHandler = () => void;

const routes: Map<string, RouteHandler> = new Map();
let notFoundHandler: RouteHandler = () => {};

export function route(path: string, handler: RouteHandler): void {
	routes.set(path, handler);
}

export function onNotFound(handler: RouteHandler): void {
	notFoundHandler = handler;
}

export function navigate(path: string): void {
	window.location.hash = path;
}

export function currentRoute(): string {
	return window.location.hash.slice(1) || "/";
}

export function startRouter(): void {
	const handleRoute = () => {
		const path = currentRoute();
		const handler = routes.get(path);
		if (handler) {
			handler();
		} else {
			notFoundHandler();
		}
	};

	window.addEventListener("hashchange", handleRoute);
	handleRoute();
}
