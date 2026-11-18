/*
 * Highlighting at build time, in the site's ink theme (the same one mdsvex uses for Markdown):
 * for pages that show the source of a file that also runs on them.
 */

import { createCssVariablesTheme, createHighlighter } from 'shiki';

const ink = createCssVariablesTheme({ name: 'ink', variablePrefix: '--code-' });
const highlighter = createHighlighter({ themes: [ink], langs: ['svelte', 'ts'] });

export async function highlight(code: string, lang: 'svelte' | 'ts'): Promise<string> {
	return (await highlighter).codeToHtml(code.trimEnd(), { lang, theme: 'ink' });
}

/** The examples' sources, by their path below `src/lib/examples/`. */
const sources = import.meta.glob('/src/lib/examples/**/*.{ts,svelte}', {
	query: '?raw',
	import: 'default',
	eager: true
}) as Record<string, string>;

export function source(path: string): string {
	const text = sources[`/src/lib/examples/${path}`];
	if (text === undefined) throw new Error(`No example at ${path}`);
	return text;
}
