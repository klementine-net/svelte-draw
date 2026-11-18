/*
 * The feature list is the repository's FEATURES.md, the one list of what is built. It is read
 * at build time; its title is the page's own, and links into the repository go to GitHub.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { marked } from 'marked';

const REPOSITORY = 'https://github.com/simon-lund/svelte-draw/blob/main/';

export function load() {
	const markdown = readFileSync(resolve(process.cwd(), '../FEATURES.md'), 'utf8')
		// The page has its title already.
		.replace(/^# .*\n/, '');
	const html = (marked.parse(markdown, { async: false }) as string)
		.replace(/href="(?!https?:|#)([^"]+)"/g, (_, path) => `href="${REPOSITORY}${path}"`)
		// A wide table scrolls inside itself.
		.replace(/<table>/g, '<div class="table-scroll"><table>')
		.replace(/<\/table>/g, '</table></div>');
	return { html };
}
