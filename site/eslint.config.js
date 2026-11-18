import { svelteApp } from '../eslint.config.base.js';

export default [
	...svelteApp(import.meta.dirname),
	{
		// Every internal link goes through `href()` in nav.ts, which calls resolve(); the rule
		// only sees resolve() written in the attribute itself.
		rules: { 'svelte/no-navigation-without-resolve': ['error', { ignoreLinks: true }] }
	}
];
