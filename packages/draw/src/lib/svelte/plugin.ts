/*
 * A plugin, as the Svelte layer sees it: the core's part (shape utils, tools, shortcuts) plus
 * what goes on screen for it: one view per shape kind, and the tools' entries in the toolbar.
 */

import type { Component } from 'svelte';
import ArrowUpRight from 'phosphor-svelte/lib/ArrowUpRight';
import Circle from 'phosphor-svelte/lib/Circle';
import Cloud from 'phosphor-svelte/lib/Cloud';
import Cursor from 'phosphor-svelte/lib/Cursor';
import Diamond from 'phosphor-svelte/lib/Diamond';
import Eraser from 'phosphor-svelte/lib/Eraser';
import FrameCorners from 'phosphor-svelte/lib/FrameCorners';
import Hand from 'phosphor-svelte/lib/Hand';
import Heart from 'phosphor-svelte/lib/Heart';
import Hexagon from 'phosphor-svelte/lib/Hexagon';
import Highlighter from 'phosphor-svelte/lib/Highlighter';
import ImageSquare from 'phosphor-svelte/lib/ImageSquare';
import Flashlight from 'phosphor-svelte/lib/Flashlight';
import NoteBlank from 'phosphor-svelte/lib/NoteBlank';
import LineSegment from 'phosphor-svelte/lib/LineSegment';
import PencilSimple from 'phosphor-svelte/lib/PencilSimple';
import Square from 'phosphor-svelte/lib/Square';
import Star from 'phosphor-svelte/lib/Star';
import TextT from 'phosphor-svelte/lib/TextT';
import Triangle from 'phosphor-svelte/lib/Triangle';
import {
	drawPlugin as drawCore,
	eraserPlugin as eraserCore,
	framePlugin as frameCore,
	geoPlugin as geoCore,
	groupPlugin,
	imagePlugin as imageCore,
	laserPlugin as laserCore,
	linkPlugin as linkCore,
	notePlugin as noteCore,
	handPlugin as handCore,
	linePlugin as lineCore,
	selectPlugin as selectCore,
	textPlugin as textCore,
	type DrawPlugin,
	type Editor,
	type ShapeRecord
} from '../index.ts';
import DrawView from './draw-view.svelte';
import GeoView from './geo-view.svelte';
import FrameView from './frame-view.svelte';
import ImageView from './image-view.svelte';
import LinkView from './link-view.svelte';
import NoteView from './note-view.svelte';
import LineView from './line-view.svelte';
import TextView from './text-view.svelte';

/** What a shape's view gets. It draws in the shape's own space; the canvas places it. */
export interface ShapeViewProps<S extends ShapeRecord = ShapeRecord> {
	shape: S;
	editor: Editor;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ShapeView = Component<ShapeViewProps<any>>;

export interface ToolbarItem {
	/** The tool this entry picks. */
	tool: string;
	/** Its name, read out and shown as the hint. */
	label: string;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	icon: Component<any>;
	/** The key that picks it, shown in the hint. */
	shortcut?: string;
	/**
	 * Tools with the same group share one place in the bar: the one picked last shows, a caret
	 * beside it opens the rest. The group's name comes from the labels (`groups`).
	 */
	group?: string;
}

/** A button in the toolbar that does something at once, instead of picking a tool. */
export interface ToolbarAction {
	id: string;
	label: string;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	icon: Component<any>;
	run: (editor: Editor) => void;
}

export interface DrawSveltePlugin extends DrawPlugin {
	/** Shape kind → the component that draws it. */
	views?: Record<string, ShapeView>;
	toolbar?: ToolbarItem[];
	actions?: ToolbarAction[];
}

/** Opens the file picker and adds the picked files in the middle of the view. */
export function pickFiles(editor: Editor, accept = 'image/*') {
	const input = document.createElement('input');
	input.type = 'file';
	input.accept = accept;
	input.multiple = true;
	input.onchange = () => {
		const { w, h } = editor.viewport.peek();
		void editor.addFiles([...(input.files ?? [])], editor.screenToPage({ x: w / 2, y: h / 2 }));
	};
	input.click();
}

export const selectPlugin: DrawSveltePlugin = {
	...selectCore,
	toolbar: [{ tool: 'select', label: 'Select', icon: Cursor, shortcut: 'V' }]
};

export const handPlugin: DrawSveltePlugin = {
	...handCore,
	toolbar: [{ tool: 'hand', label: 'Move the view', icon: Hand, shortcut: 'H' }]
};

export const drawPlugin: DrawSveltePlugin = {
	...drawCore,
	views: { draw: DrawView },
	toolbar: [
		{ tool: 'draw', label: 'Draw', icon: PencilSimple, shortcut: 'D', group: 'pen' },
		{ tool: 'highlight', label: 'Highlight', icon: Highlighter, shortcut: 'M', group: 'pen' }
	]
};

export const laserPlugin: DrawSveltePlugin = {
	...laserCore,
	toolbar: [
		{ tool: 'laser', label: 'Laser pointer', icon: Flashlight, shortcut: 'K', group: 'pen' }
	]
};

export const eraserPlugin: DrawSveltePlugin = {
	...eraserCore,
	toolbar: [{ tool: 'eraser', label: 'Erase', icon: Eraser, shortcut: 'E' }]
};

export const geoPlugin: DrawSveltePlugin = {
	...geoCore,
	views: { geo: GeoView },
	toolbar: [
		{ tool: 'rectangle', label: 'Rectangle', icon: Square, shortcut: 'R', group: 'shape' },
		{ tool: 'ellipse', label: 'Ellipse', icon: Circle, shortcut: 'O', group: 'shape' },
		{ tool: 'triangle', label: 'Triangle', icon: Triangle, group: 'shape' },
		{ tool: 'diamond', label: 'Diamond', icon: Diamond, group: 'shape' },
		{ tool: 'hexagon', label: 'Hexagon', icon: Hexagon, group: 'shape' },
		{ tool: 'star', label: 'Star', icon: Star, group: 'shape' },
		{ tool: 'cloud', label: 'Cloud', icon: Cloud, group: 'shape' },
		{ tool: 'heart', label: 'Heart', icon: Heart, group: 'shape' }
	]
};

export const linePlugin: DrawSveltePlugin = {
	...lineCore,
	views: { line: LineView },
	toolbar: [
		{ tool: 'line', label: 'Line', icon: LineSegment, shortcut: 'L', group: 'shape' },
		{ tool: 'arrow', label: 'Arrow', icon: ArrowUpRight, shortcut: 'A', group: 'shape' }
	]
};

export const textPlugin: DrawSveltePlugin = {
	...textCore,
	views: { text: TextView },
	toolbar: [{ tool: 'text', label: 'Text', icon: TextT, shortcut: 'T' }]
};

export const notePlugin: DrawSveltePlugin = {
	...noteCore,
	views: { note: NoteView },
	toolbar: [{ tool: 'note', label: 'Note', icon: NoteBlank, shortcut: 'N' }]
};

export const imagePlugin: DrawSveltePlugin = {
	...imageCore,
	views: { image: ImageView },
	actions: [{ id: 'image', label: 'Image', icon: ImageSquare, run: (editor) => pickFiles(editor) }]
};

export const linkPlugin: DrawSveltePlugin = { ...linkCore, views: { link: LinkView } };

export const framePlugin: DrawSveltePlugin = {
	...frameCore,
	views: { frame: FrameView },
	toolbar: [{ tool: 'frame', label: 'Frame', icon: FrameCorners, shortcut: 'F' }]
};

export const defaultPlugins: DrawSveltePlugin[] = [
	selectPlugin,
	handPlugin,
	drawPlugin,
	laserPlugin,
	eraserPlugin,
	geoPlugin,
	linePlugin,
	linkPlugin,
	textPlugin,
	notePlugin,
	imagePlugin,
	framePlugin,
	groupPlugin
];
