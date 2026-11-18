import { highlight, source } from '#lib/server/highlight.ts';

// The plugin on the page, highlighted at build time from the very files the page runs.
export async function load() {
	return {
		util: await highlight(source('dot/dot.ts'), 'ts'),
		view: await highlight(source('dot/dot-view.svelte'), 'svelte'),
		plugin: await highlight(source('dot/plugin.ts'), 'ts')
	};
}
