/*
 * @klementine/draw: the core. Plain TypeScript, no UI framework: it runs in a browser, in a
 * test and on a server alike. The Svelte layer is `@klementine/draw/svelte`.
 */

import type { DrawPlugin } from './core/editor.ts';
import { SelectTool } from './tools/select.ts';
import { HandTool } from './tools/hand.ts';
import { DrawShapeUtil, DrawTool } from './shapes/draw.ts';
import { EllipseTool, GeoShapeUtil, RectangleTool } from './shapes/geo.ts';
import { ArrowTool, LineShapeUtil, LineTool } from './shapes/line.ts';

export { Atom, atom, setTracker, type Tracker } from './core/signal.ts';
export { box, vec, type Box, type Vec } from './core/geometry.ts';
export { byIndex, indexBetween, indexesAbove } from './core/indexing.ts';
export * from './core/records.ts';
export {
	Store,
	emptyDiff,
	invertDiff,
	isEmptyDiff,
	mergeDiff,
	type ChangeSource,
	type Diff,
	type StoreListener
} from './core/store.ts';
export { History } from './core/history.ts';
export { ShapeUtil, type ResizeResult, type ShapeUtilConstructor } from './core/shape-util.ts';
export { StateNode, type StateNodeConstructor } from './core/state-node.ts';
export type { CancelInfo, DrawEvent, KeyInfo, PointerInfo, WheelInfo } from './core/events.ts';
export {
	Editor,
	HANDLES,
	pointer,
	type Camera,
	type DrawPlugin,
	type EditorOptions,
	type Handle,
	type NewShape,
	type ShapePatch
} from './core/editor.ts';

export { SelectTool, type ResizingInfo } from './tools/select.ts';
export { HandTool } from './tools/hand.ts';
export { BoxTool, type BoxToolShape } from './tools/box-tool.ts';
export { DrawShapeUtil, DrawTool, inkSize, type DrawProps, type DrawShape } from './shapes/draw.ts';
export {
	EllipseTool,
	GeoShapeUtil,
	RectangleTool,
	type GeoProps,
	type GeoShape
} from './shapes/geo.ts';
export {
	ArrowTool,
	LineShapeUtil,
	LineTool,
	type LineProps,
	type LineShape
} from './shapes/line.ts';
export {
	arrowHead,
	sketchLine,
	inkPath,
	outlineToPath,
	seededRandom,
	sketchEllipse,
	sketchRectangle,
	type InkPoint
} from './shapes/sketch.ts';

/* The built-in plugins, without their views (the Svelte layer adds those). */

export const selectPlugin: DrawPlugin = {
	name: 'select',
	tools: [SelectTool],
	shortcuts: { v: 'select' }
};

export const handPlugin: DrawPlugin = { name: 'hand', tools: [HandTool], shortcuts: { h: 'hand' } };

export const drawPlugin: DrawPlugin = {
	name: 'draw',
	shapes: [DrawShapeUtil],
	tools: [DrawTool],
	shortcuts: { d: 'draw', p: 'draw' }
};

export const geoPlugin: DrawPlugin = {
	name: 'geo',
	shapes: [GeoShapeUtil],
	tools: [RectangleTool, EllipseTool],
	shortcuts: { r: 'rectangle', o: 'ellipse' }
};

export const linePlugin: DrawPlugin = {
	name: 'line',
	shapes: [LineShapeUtil],
	tools: [LineTool, ArrowTool],
	shortcuts: { l: 'line', a: 'arrow' }
};

export const corePlugins: DrawPlugin[] = [
	selectPlugin,
	handPlugin,
	drawPlugin,
	geoPlugin,
	linePlugin
];
