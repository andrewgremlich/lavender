import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";
import { serviceWorkerPlugin } from "./vite-sw-plugin";

export default defineConfig({
	resolve: {
		tsconfigPaths: true,
	},
	plugins: [
		serviceWorkerPlugin({
			swSrc: "public/sw-template.js",
			swDest: "sw.js",
			manifest: {
				shortName: "LHT",
				display: "standalone",
				backgroundColor: "#5b21b6",
				themeColor: "#7c3aed",
			},
		}),
		cloudflare(),
	],
});
