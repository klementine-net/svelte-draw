/*
 * The example's controls for svelte-draw: a toolbar, a style panel, a page menu, a zoom
 * control and a right-click menu, and `Whiteboard`, which puts them around the library's
 * canvas. The library brings no controls of its own: copy these and make them yours.
 */

export { default as Whiteboard } from './whiteboard.svelte';
export { default as DrawToolbar } from './draw-toolbar.svelte';
export { default as StylePanel } from './style-panel.svelte';
export { default as StyleRow } from './style-row.svelte';
export { default as ZoomControl } from './zoom-control.svelte';
export { default as PageMenu } from './page-menu.svelte';
export { default as CanvasMenu } from './canvas-menu.svelte';
export { default as Hint } from './hint.svelte';
export { defaultLabels, type DrawLabels } from './labels.ts';
export { setScheme, toCanvas, useScheme, type Scheme } from './board.ts';
