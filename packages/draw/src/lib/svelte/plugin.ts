/*
 * A plugin, as the Svelte layer sees it: the core's part (shape utils, tools, shortcuts) plus
 * what goes on screen for it: one view per shape kind, and the tools' entries in the toolbar.
 */

import type { Component } from 'svelte';
import ArrowUpRight from 'phosphor-svelte/lib/ArrowUpRight';
import BoundingBox from 'phosphor-svelte/lib/BoundingBox';
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

export interface DrawSveltePlugin extends DrawPlugin {
	/** Shape kind → the component that draws it. */
	views?: Record<string, ShapeView>;
	toolbar?: ToolbarItem[];
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

export const framePlugin: DrawSveltePlugin = {
	...frameCore,
	views: { frame: FrameView },
	toolbar: [{ tool: 'frame', label: 'Frame', icon: FrameCorners, shortcut: 'F' }]
};

export const defaultPlugins: DrawSveltePlugin[] = [
	selectPlugin,
	handPlugin,
	drawPlugin,
	eraserPlugin,
	geoPlugin,
	linePlugin,
	textPlugin,
	framePlugin,
	groupPlugin
];

/** The icon for a shape kind with no view (its plugin is missing). */
export const MissingIcon = BoundingBox;
