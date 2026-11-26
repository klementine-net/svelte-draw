/*
 * The words svelte-draw's own controls say, in English. An app in another language passes
 * its translations as `labels` (all of them or a few; the rest stay English). A plugin's tool
 * names travel with the plugin (`toolbar[].label`).
 */

export const defaultLabels = {
	canvas: 'Canvas',
	tools: 'Tools',
	/** The names of the toolbar's groups, by group id; they name the caret that opens a group. */
	groups: { shape: 'More shapes', pen: 'More pens' } as Record<string, string>,
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
		violet: 'Violet',
		white: 'White',
		'light-red': 'Light red',
		'light-green': 'Light green',
		'light-blue': 'Light blue',
		'light-violet': 'Light violet'
	},
	fill: 'Fill',
	fills: { none: 'No fill', tint: 'Light fill', solid: 'Full fill', pattern: 'Hatched' },
	size: 'Size',
	sizes: { s: 'Small', m: 'Medium', l: 'Large', xl: 'Extra large' },
	look: 'Line style',
	looks: { sketch: 'Hand-drawn', precise: 'Exact', dashed: 'Dashed', dotted: 'Dotted' },
	font: 'Typeface',
	fonts: { hand: 'Handwriting', sans: 'Sans serif', serif: 'Serif', mono: 'Monospace' },
	align: 'Text alignment',
	aligns: { start: 'Left', middle: 'Centre', end: 'Right' },
	valign: 'Text position',
	valigns: { top: 'Top', middle: 'Middle', bottom: 'Bottom' },
	opacity: 'Opacity',
	zoom: 'Zoom',
	zoomIn: 'Zoom in',
	zoomOut: 'Zoom out',
	zoomReset: 'Back to 100%',
	zoomFit: 'Show everything',
	minimap: 'Map of the page',
	pages: {
		label: 'Pages',
		add: 'New page',
		rename: 'Rename page',
		delete: 'Delete page',
		/** The name of the nth page. */
		name: (n: number) => `Page ${n}`
	},
	file: {
		label: 'File',
		save: 'Save to a file',
		open: 'Open a file',
		picture: 'Save as a picture'
	},
	/** The switches a shape kind offers in the right-click menu, by their id. */
	toggles: {
		arrowStart: 'Arrowhead at the start',
		arrowEnd: 'Arrowhead at the end',
		elbow: 'Right angles'
	} as Record<string, string>,
	/** The menu a right-click (or a long press) on the canvas opens. */
	menu: {
		cut: 'Cut',
		copy: 'Copy',
		paste: 'Paste',
		duplicate: 'Duplicate',
		copyPicture: 'Copy as a picture',
		delete: 'Delete',
		selectAll: 'Select all',
		order: 'Order',
		toFront: 'Bring to front',
		forward: 'Bring forward',
		backward: 'Send backward',
		toBack: 'Send to back',
		align: 'Align',
		alignLeft: 'Left',
		alignCenter: 'Centre',
		alignRight: 'Right',
		alignTop: 'Top',
		alignMiddle: 'Middle',
		alignBottom: 'Bottom',
		distributeX: 'Space evenly across',
		distributeY: 'Space evenly down',
		flip: 'Flip',
		flipX: 'Left to right',
		flipY: 'Top to bottom',
		group: 'Group',
		ungroup: 'Ungroup',
		lock: 'Lock',
		unlock: 'Unlock',
		zoomToSelection: 'Zoom to selection',
		showGrid: 'Show the grid',
		snapGrid: 'Snap to the grid'
	}
};

export type DrawLabels = typeof defaultLabels;
