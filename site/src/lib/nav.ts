/*
 * The documentation's pages in reading order: the sidebar, the phone's menu and the links to the
 * next and previous page are all made from this one list.
 */

import { resolve } from '$app/paths';
import { page } from '$app/state';

/** A link to `path` (from the site's root, like `/docs/start/`), wherever the site is served. */
export const href = (path: string) => resolve('/').replace(/\/$/, '') + path;

/** Where the reader is, from the site's root, with a trailing slash: `/docs/start/`. */
export const here = () => (page.route.id === '/' ? '/' : `${page.route.id}/`);

export interface DocPage {
	/** Below the site's base, with a trailing slash. */
	path: string;
	title: string;
	/** One sentence: what the page is for. Shown under its title. */
	summary: string;
	/** The file the page is written in, from the repository's root (for "Edit this page"). */
	source: string;
}

export interface DocSection {
	title: string;
	pages: DocPage[];
}

const entry = (path: string, title: string, summary: string, file: string): DocPage => ({
	path,
	title,
	summary,
	source: `site/src/routes${path}${file}`
});

export const sections: DocSection[] = [
	{
		title: 'Start',
		pages: [
			entry(
				'/docs/',
				'Introduction',
				'What Draw is, what it can do, and where it stands.',
				'+page.md'
			),
			entry(
				'/docs/start/',
				'Getting started',
				'From installing it to a canvas on your own page, and where its controls come from.',
				'+page.md'
			)
		]
	},
	{
		title: 'Guides',
		pages: [
			entry(
				'/docs/concepts/',
				'How it is built',
				'The two layers and the five ideas everything else rests on.',
				'+page.md'
			),
			entry(
				'/docs/scripting/',
				'Driving the editor',
				'Everything a person does on the canvas, done from code.',
				'+page.md'
			),
			entry(
				'/docs/plugins/',
				'Writing a plugin',
				'A kind of shape of your own, its tool, its picture and its place in the toolbar.',
				'+page.md'
			),
			entry(
				'/docs/saving/',
				'Saving and sharing',
				'Keeping a board, keeping tabs in step, and files, pictures and other people.',
				'+page.md'
			),
			entry(
				'/docs/styling/',
				'Look and controls',
				"A shape's styles, the canvas's colours, and controls of your own around it.",
				'+page.md'
			)
		]
	},
	{
		title: 'Reference',
		pages: [
			entry(
				'/docs/reference/',
				'API',
				"The editor's methods, the hooks of a kind of shape, and the components.",
				'+page.svelte'
			),
			entry(
				'/docs/features/',
				'What is built',
				'Every feature: built, partly built or missing.',
				'+page.svelte'
			)
		]
	}
];

export const pages = sections.flatMap((section) => section.pages);

/** The page at `path` (below the base), with the ones before and after it. */
export function locate(path: string) {
	const at = pages.findIndex((item) => item.path === path);
	return { page: pages[at], previous: pages[at - 1], next: pages[at + 1] };
}

export const REPOSITORY = 'https://github.com/simon-lund/svelte-draw';
