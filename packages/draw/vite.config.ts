/*
 * The browser tests (`pnpm test:browser`): the Svelte layer in Chromium, through Playwright.
 * The engine's tests do not need a browser and run under Node (`pnpm test`).
 */

import { svelte } from '@sveltejs/vite-plugin-svelte';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [svelte()],
	test: {
		include: ['tests/browser/*.test.ts'],
		browser: {
			enabled: true,
			headless: true,
			// The Chrome installed on the machine: nothing to download, and the browser people use.
			provider: playwright({ launchOptions: { channel: 'chrome' } }),
			instances: [{ browser: 'chromium' }]
		}
	}
});
