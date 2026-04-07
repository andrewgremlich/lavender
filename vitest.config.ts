import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [svelte({ hot: false })],
	resolve: {
		conditions: ['browser']
	},
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}'],
		environment: 'jsdom',
		setupFiles: ['src/tests/setup.ts'],
		alias: {
			$lib: new URL('./src/lib', import.meta.url).pathname,
			'$app/navigation': new URL('./src/tests/mocks/app-navigation.ts', import.meta.url).pathname,
			'$app/environment': new URL('./src/tests/mocks/app-environment.ts', import.meta.url).pathname,
			'$app/stores': new URL('./src/tests/mocks/app-stores.ts', import.meta.url).pathname
		}
	}
});
