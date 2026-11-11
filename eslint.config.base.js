// The ESLint config the workspace's SvelteKit packages share. A package's eslint.config.js passes its own
// folder (for its .gitignore) and any extra ignores:
//   export default svelteApp(import.meta.dirname);
import prettier from 'eslint-config-prettier';
import path from 'node:path';
import { includeIgnoreFile } from '@eslint/compat';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';

/**
 * @param {string} appDir the app's folder (`import.meta.dirname`)
 * @param {string[]} [ignores] extra paths to skip, relative to the app
 */
export function svelteApp(appDir, ignores = []) {
	return defineConfig(
		includeIgnoreFile(path.resolve(appDir, '.gitignore')),
		...(ignores.length ? [{ ignores }] : []),
		js.configs.recommended,
		ts.configs.recommended,
		svelte.configs.recommended,
		prettier,
		svelte.configs.prettier,
		{
			languageOptions: { globals: { ...globals.browser, ...globals.node } },
			rules: {
				// typescript-eslint strongly recommend that you do not use the no-undef lint rule on TypeScript projects.
				// see: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
				'no-undef': 'off',
				// A leading underscore marks a parameter that has to be there but isn't used (snippet args).
				'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
			}
		},
		{
			// SvelteKit 3 keeps the Svelte config in vite.config.ts, so there is no svelte.config.js to pass.
			files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
			languageOptions: {
				parserOptions: {
					projectService: true,
					extraFileExtensions: ['.svelte'],
					parser: ts.parser
				}
			}
		}
	);
}
