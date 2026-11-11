/*
 * The words Klementine Draw's own controls say, in English. An app in another language passes
 * its translations as `labels` (all of them or a few; the rest stay English). A plugin's tool
 * names travel with the plugin (`toolbar[].label`).
 */

export const defaultLabels = {
	canvas: 'Canvas',
	tools: 'Tools',
	/** The names of the toolbar's groups, by group id; they name the caret that opens a group. */
	groups: { shape: 'More shapes' } as Record<string, string>,
	undo: 'Undo',
	redo: 'Redo',
	style: 'Style',
	color: 'Colour',
	colors: {
		ink: 'Ink',
		grey: 'Grey',
		red: 'Red',
		yellow: 'Yellow',
		green: 'Green',
		blue: 'Blue',
		violet: 'Violet'
	},
	fill: 'Fill',
	fills: { none: 'No fill', tint: 'Light fill', solid: 'Full fill' },
	size: 'Line width',
	sizes: { s: 'Thin', m: 'Medium', l: 'Thick' },
	look: 'Line style',
	looks: { sketch: 'Hand-drawn', precise: 'Exact' },
	zoom: 'Zoom',
	zoomIn: 'Zoom in',
	zoomOut: 'Zoom out',
	zoomReset: 'Back to 100%',
	zoomFit: 'Show everything'
};

export type DrawLabels = typeof defaultLabels;
