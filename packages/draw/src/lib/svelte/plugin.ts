/*
 * A plugin, as the Svelte layer sees it: the core's part (shape utils, tools, shortcuts) plus
 * what goes on screen for it: one view per shape kind, and the tools' entries in the toolbar.
 */

import type { Component } from 'svelte';
import ArrowUpRight from 'phosphor-svelte/lib/ArrowUpRight';
import BoundingBox from 'phosphor-svelte/lib/BoundingBox';
import Circle from 'phosphor-svelte/lib/Circle';
import Cursor from 'phosphor-svelte/lib/Cursor';
import Hand from 'phosphor-svelte/lib/Hand';
import LineSegment from 'phosphor-svelte/lib/LineSegment';
import PencilSimple from 'phosphor-svelte/lib/PencilSimple';
import Square from 'phosphor-svelte/lib/Square';
import {
	drawPlugin as drawCore,
	geoPlugin as geoCore,
	handPlugin as handCore,
	linePlugin as lineCore,
	selectPlugin as selectCore,
	type DrawPlugin,
	type Editor,
	type ShapeRecord
} from '../index.ts';
import DrawView from './draw-view.svelte';
import GeoView from './geo-view.svelte';
import LineView from './line-view.svelte';

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
	toolbar: [{ tool: 'draw', label: 'Draw', icon: PencilSimple, shortcut: 'D' }]
};

export const geoPlugin: DrawSveltePlugin = {
	...geoCore,
	views: { geo: GeoView },
	toolbar: [
		{ tool: 'rectangle', label: 'Rectangle', icon: Square, shortcut: 'R', group: 'shape' },
		{ tool: 'ellipse', label: 'Ellipse', icon: Circle, shortcut: 'O', group: 'shape' }
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

export const defaultPlugins: DrawSveltePlugin[] = [
	selectPlugin,
	handPlugin,
	drawPlugin,
	geoPlugin,
	linePlugin
];

/** The icon for a shape kind with no view (its plugin is missing). */
export const MissingIcon = BoundingBox;
