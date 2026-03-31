import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Plugin } from "vite";

interface ManifestOptions {
	shortName?: string;
	display?: "standalone" | "fullscreen" | "minimal-ui" | "browser";
	backgroundColor?: string;
	themeColor?: string;
	lang?: string;
	scope?: string;
	startUrl?: string;
	iconPrefix?: string;
}

interface ServiceWorkerPluginOptions {
	swSrc: string;
	swDest: string;
	manifest?: ManifestOptions;
}

function collectPublicAssets(dir: string, base = ""): string[] {
	const results: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const rel = `${base}/${entry.name}`;
		if (entry.isDirectory()) {
			results.push(...collectPublicAssets(resolve(dir, entry.name), rel));
		} else if (entry.name !== "sw-template.js") {
			results.push(rel);
		}
	}
	return results;
}

function discoverIcons(publicAssets: string[], prefix: string) {
	const sizeRegex = new RegExp(`^/${prefix}-(\\d+)x(\\d+)\\.png$`);
	return publicAssets
		.map((asset) => {
			const match = asset.match(sizeRegex);
			if (!match) return null;
			return {
				src: asset,
				sizes: `${match[1]}x${match[2]}`,
				type: "image/png",
			};
		})
		.filter((icon) => icon !== null);
}

function generateManifest(
	packageJson: { name: string; description?: string },
	icons: { src: string; sizes: string; type: string }[],
	options: ManifestOptions,
) {
	return {
		name: packageJson.name.charAt(0).toUpperCase() + packageJson.name.slice(1),
		short_name: options.shortName ?? packageJson.name,
		description: packageJson.description ?? "",
		start_url: options.startUrl ?? "/",
		display: options.display ?? "standalone",
		background_color: options.backgroundColor ?? "#ffffff",
		theme_color: options.themeColor ?? "#000000",
		lang: options.lang ?? "en",
		scope: options.scope ?? "/",
		icons,
	};
}

export function serviceWorkerPlugin(
	options: ServiceWorkerPluginOptions,
): Plugin {
	const { swSrc, swDest, manifest: manifestOptions = {} } = options;

	return {
		name: "service-worker-plugin",
		apply: "build",
		writeBundle(outputOptions, bundle) {
			const outputDir = outputOptions.dir || "dist";

			// Only generate for the client build (contains index.html)
			if (!bundle["index.html"]) return;

			const packageJson = JSON.parse(readFileSync("package.json", "utf-8"));
			const bundleAssets = Object.keys(bundle).map(
				(fileName) => `/${fileName}`,
			);
			const publicAssets = collectPublicAssets("public");

			// Generate manifest.webmanifest
			const icons = discoverIcons(
				publicAssets,
				manifestOptions.iconPrefix ?? "logo",
			);
			const manifest = generateManifest(packageJson, icons, manifestOptions);
			writeFileSync(
				resolve(outputDir, "manifest.webmanifest"),
				JSON.stringify(manifest, null, "\t"),
			);
			console.log(
				`✓ Generated manifest.webmanifest with ${icons.length} icons`,
			);

			// Generate service worker
			const allAssets = [
				...new Set(["/manifest.webmanifest", ...publicAssets, ...bundleAssets]),
			];
			const version = `${packageJson.version}-${Date.now()}`;
			const swTemplate = readFileSync(swSrc, "utf-8");
			const swContent = swTemplate
				.replace("__CACHE_VERSION__", version)
				.replace("__APP_VERSION__", packageJson.version)
				.replace("__ASSETS_TO_CACHE__", JSON.stringify(allAssets, null, 2));

			writeFileSync(resolve(outputDir, swDest), swContent);
			console.log(
				`✓ Generated service worker with ${allAssets.length} assets (version: ${version})`,
			);
		},
	};
}
