/*
 * svelte-draw: the canvas for Svelte, and the engine with it. Everything a Svelte app needs
 * comes from here. The engine alone, for where there is no Svelte (Node, a server, a script),
 * is `@klementine/svelte-draw/core`.
 */

import './svelte/reactive.ts';

// The whole engine. Where a name is in both (the built-in plugins), the export below wins:
// from here, a plugin comes with its views.
export * from './core.ts';

export { default as Canvas } from './svelte/canvas.svelte';
export { default as GeoView } from './svelte/geo-view.svelte';
export { default as DrawView } from './svelte/draw-view.svelte';
export { default as LineView } from './svelte/line-view.svelte';
export { default as TextView } from './svelte/text-view.svelte';
export { default as FrameView } from './svelte/frame-view.svelte';
export { default as TextLabel } from './svelte/text-label.svelte';
export { default as Minimap } from './svelte/minimap.svelte';
export { deepLink } from './svelte/deep-link.ts';
export { default as NoteView } from './svelte/note-view.svelte';
export { default as ImageView } from './svelte/image-view.svelte';
export { default as LinkView } from './svelte/link-view.svelte';
export { editText, type EditTextOptions } from './svelte/edit-text.ts';
export {
	download,
	openFile,
	saveFile,
	toPng,
	toSvg,
	type PictureOptions
} from './svelte/export.ts';
export {
	defaultPlugins,
	drawPlugin,
	eraserPlugin,
	framePlugin,
	geoPlugin,
	handPlugin,
	imagePlugin,
	laserPlugin,
	linkPlugin,
	notePlugin,
	pickFiles,
	linePlugin,
	selectPlugin,
	textPlugin,
	type DrawSveltePlugin,
	type ShapeView,
	type ShapeViewProps,
	type ToolbarAction,
	type ToolbarItem
} from './svelte/plugin.ts';
