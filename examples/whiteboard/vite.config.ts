import { svelte } from '@sveltejs/vite-plugin-svelte';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

/* The whiteboard example of svelte-draw (`pnpm dev` at the repo root). */
export default defineConfig({
	root: import.meta.dirname,
	server: { port: 5196, strictPort: true },
	plugins: [svelte({ compilerOptions: { runes: true } })],
	// The controls' tests (`pnpm test:browser`), in the Chrome installed on the machine.
	test: {
		include: ['tests/*.test.ts'],
		browser: {
			enabled: true,
			headless: true,
			provider: playwright({ launchOptions: { channel: 'chrome' } }),
			instances: [{ browser: 'chromium' }]
		}
	}
});
