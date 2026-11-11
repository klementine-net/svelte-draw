import tailwindcss from '@tailwindcss/vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

/* The whiteboard example of Klementine Draw (`pnpm dev` at the repo root). */
export default defineConfig({
	root: import.meta.dirname,
	server: { port: 5196, strictPort: true },
	plugins: [tailwindcss(), svelte({ compilerOptions: { runes: true } })]
});
