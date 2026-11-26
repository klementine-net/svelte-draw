import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { escapeSvelte, mdsvex } from 'mdsvex';
import { createCssVariablesTheme, createHighlighter } from 'shiki';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

/*
 * The documentation website of svelte-draw: every page prerendered to static files in
 * build/, served by GitHub Pages under /svelte-draw/ (scripts/publish-site.sh puts the demo
 * beside it at /svelte-draw/demo/). Pages are Svelte or Markdown (mdsvex).
 */

// Code in ink: the colours of a highlighter would be the only colour on the page that nobody
// drew, so tokens get the theme's ink tones instead (see code.css).
const inkTheme = createCssVariablesTheme({ name: 'ink', variablePrefix: '--code-' });
const highlighter = await createHighlighter({
	themes: [inkTheme],
	langs: ['svelte', 'ts', 'js', 'sh', 'css', 'json', 'html']
});
/** @param {string} code @param {string | null | undefined} lang */
const highlight = (code, lang) => {
	const known = lang && highlighter.getLoadedLanguages().includes(lang) ? lang : 'text';
	const html = escapeSvelte(highlighter.codeToHtml(code, { lang: known, theme: 'ink' }));
	return `{@html \`${html}\`}`;
};

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			extensions: ['.svelte', '.md'],
			preprocess: [
				mdsvex({
					extensions: ['.md'],
					highlight: { highlighter: highlight },
					layout: {
						_: fileURLToPath(new URL('./src/lib/components/doc-layout.svelte', import.meta.url))
					}
				})
			],
			compilerOptions: {
				// Runes everywhere except in Markdown (mdsvex writes the older component form) and in
				// what is installed.
				runes: ({ filename }) =>
					filename.endsWith('.md') || filename.split(/[/\\]/).includes('node_modules')
						? undefined
						: true
			},
			// 404.html: GitHub Pages serves it for an address that has no page.
			adapter: adapter({ pages: 'build', assets: 'build', fallback: '404.html', strict: true }),
			paths: {
				base: /** @type {'' | `/${string}`} */ (process.env.BASE_PATH ?? '/svelte-draw')
			},
			prerender: {
				// The demo is published beside the site, not by it.
				handleHttpError: ({ path, message }) => {
					if (path.endsWith('/demo/')) return;
					throw new Error(message);
				}
			}
		})
	],
	// The repository's own files (FEATURES.md) are read by the site.
	server: { port: 5197, strictPort: true, fs: { allow: ['..'] } },
	// Both ship their TypeScript and Svelte sources: they are compiled with the site, never
	// pre-bundled.
	optimizeDeps: {
		exclude: ['@simon-lund/svelte-draw', 'svelte-draw-example-whiteboard']
	},
	ssr: {
		noExternal: ['@simon-lund/svelte-draw', 'svelte-draw-example-whiteboard']
	}
});
