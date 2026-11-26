/*
 * The board on the home page: a few things a person would put on a whiteboard, each saying one
 * thing about Draw, and showing its look while it does.
 */

import { Editor } from '@klementine/svelte-draw';
import {
	defaultPlugins,
	drawPlugin,
	geoPlugin,
	notePlugin,
	selectPlugin,
	textPlugin,
	type DrawSveltePlugin
} from '@klementine/svelte-draw/svelte';

/** The editor's kinds and tools: everything, so whatever someone pastes or opens works. */
export const plugins: DrawSveltePlugin[] = defaultPlugins;

/**
 * The tools a phone's toolbar shows, so the bar fits a phone's width: select, the pen, the
 * shapes, a note and text. The demo has the rest.
 */
export const phoneTools: DrawSveltePlugin[] = [
	selectPlugin,
	{ ...drawPlugin, toolbar: drawPlugin.toolbar?.slice(0, 1) },
	geoPlugin,
	notePlugin,
	textPlugin
];

/**
 * The board: a small cluster (about 670 × 410), so it reads at full size on a desk and still at
 * half size on a phone, with paper around it to draw on.
 */
export function homeBoard(): Editor {
	const editor = new Editor({ plugins });
	editor.createShape({
		kind: 'note',
		x: 0,
		y: 0,
		props: { w: 180, h: 180, text: 'Draw on this page' },
		style: { color: 'yellow' }
	});
	const box = editor.createShape({
		kind: 'geo',
		x: 240,
		y: 30,
		props: { w: 190, h: 110, text: 'Drag me' },
		style: { color: 'violet', fill: 'tint' }
	});
	const circle = editor.createShape({
		kind: 'geo',
		x: 520,
		y: 10,
		props: { geo: 'ellipse', w: 150, h: 150, text: 'and me' },
		style: { color: 'green', fill: 'tint' }
	});
	editor.createShape({
		kind: 'line',
		x: 440,
		y: 85,
		props: { dx: 70, dy: 0, arrow: true, start: box.id, end: circle.id, bend: -22 }
	});
	editor.createShape({
		kind: 'note',
		x: 10,
		y: 230,
		props: { w: 180, h: 180, text: 'Arrows stay attached when you move a shape' },
		style: { color: 'blue' }
	});
	editor.createShape({
		kind: 'geo',
		x: 270,
		y: 265,
		props: { geo: 'star', w: 110, h: 110 },
		style: { color: 'yellow', fill: 'solid' }
	});
	editor.createShape({
		kind: 'note',
		x: 480,
		y: 225,
		props: { w: 180, h: 180, text: 'Shapes and tools are plugins' },
		style: { color: 'red' }
	});
	editor.history.clear();
	return editor;
}
