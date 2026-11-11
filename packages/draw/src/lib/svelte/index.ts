/* @klementine/draw/svelte: the Svelte layer. The core is `@klementine/draw`. */

import './reactive.ts';

export { default as Draw } from './draw.svelte';
export { default as Canvas } from './canvas.svelte';
export { default as DrawToolbar } from './draw-toolbar.svelte';
export { default as StylePanel } from './style-panel.svelte';
export { default as ZoomControl } from './zoom-control.svelte';
export { default as GeoView } from './geo-view.svelte';
export { default as DrawView } from './draw-view.svelte';
export { default as LineView } from './line-view.svelte';
export { default as TextView } from './text-view.svelte';
export { default as FrameView } from './frame-view.svelte';
export { default as TextLabel } from './text-label.svelte';
export { default as CanvasMenu } from './canvas-menu.svelte';
export { default as PageMenu } from './page-menu.svelte';
export { default as Minimap } from './minimap.svelte';
export { deepLink } from './deep-link.ts';
export { default as NoteView } from './note-view.svelte';
export { default as ImageView } from './image-view.svelte';
export { default as LinkView } from './link-view.svelte';
export { editText, type EditTextOptions } from './edit-text.ts';
export { download, openFile, saveFile, toPng, toSvg, type PictureOptions } from './export.ts';
export { defaultLabels, type DrawLabels } from './labels.ts';
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
} from './plugin.ts';
