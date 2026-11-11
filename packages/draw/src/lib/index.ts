/*
 * @klementine/draw: the core. Plain TypeScript, no UI framework: it runs in a browser, in a
 * test and on a server alike. The Svelte layer is `@klementine/draw/svelte`.
 */

import type { DrawPlugin } from './core/editor.ts';
import { SelectTool } from './tools/select.ts';
import { HandTool } from './tools/hand.ts';
import { EraserTool } from './tools/eraser.ts';
import { DrawShapeUtil, DrawTool, HighlightTool } from './shapes/draw.ts';
import { EllipseTool, GEO_TOOLS, GeoShapeUtil, RectangleTool } from './shapes/geo.ts';
import { TextShapeUtil, TextTool } from './shapes/text.ts';
import { GroupShapeUtil } from './shapes/group.ts';
import { FrameShapeUtil, FrameTool } from './shapes/frame.ts';
import { ArrowTool, LineShapeUtil, LineTool } from './shapes/line.ts';

export { Atom, atom, setTracker, type Tracker } from './core/signal.ts';
export { box, polygon, vec, type Box, type Vec } from './core/geometry.ts';
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
export {
	ShapeUtil,
	type ResizeResult,
	type ShapeHandle,
	type ShapeUtilConstructor
} from './core/shape-util.ts';
export { StateNode, type StateNodeConstructor } from './core/state-node.ts';
export type { CancelInfo, DrawEvent, KeyInfo, PointerInfo, WheelInfo } from './core/events.ts';
export {
	Editor,
	HANDLES,
	pointer,
	type AlignEdge,
	type Camera,
	type DrawPlugin,
	type EditorOptions,
	type Handle,
	type NewShape,
	type ShapePatch,
	type SnapLine
} from './core/editor.ts';

export {
	SelectTool,
	type DraggingHandleInfo,
	type EditingInfo,
	type ResizingInfo
} from './tools/select.ts';
export { EraserTool } from './tools/eraser.ts';
export { HandTool } from './tools/hand.ts';
export { BoxTool, type BoxToolShape } from './tools/box-tool.ts';
export {
	DrawShapeUtil,
	DrawTool,
	HighlightTool,
	inkSize,
	type DrawProps,
	type DrawShape
} from './shapes/draw.ts';
export {
	EllipseTool,
	GEO_TOOLS,
	GeoShapeUtil,
	geoPath,
	geoTool,
	RectangleTool,
	type GeoProps,
	type GeoShape
} from './shapes/geo.ts';
export { GEO_KINDS, geoMarks, geoPoints, SMOOTH, type GeoKind } from './shapes/geo-paths.ts';
export { TextShapeUtil, TextTool, type TextProps, type TextShape } from './shapes/text.ts';
export { GroupShapeUtil, type GroupShape } from './shapes/group.ts';
export {
	FRAME_NAME_HEIGHT,
	FrameShapeUtil,
	FrameTool,
	type FrameProps,
	type FrameShape
} from './shapes/frame.ts';
export {
	ArrowTool,
	LineShapeUtil,
	LineTool,
	lineEnds,
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
	sketchLoop,
	sketchPolygon,
	sketchPolyline,
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

export const eraserPlugin: DrawPlugin = {
	name: 'eraser',
	tools: [EraserTool],
	shortcuts: { e: 'eraser' }
};

export const drawPlugin: DrawPlugin = {
	name: 'draw',
	shapes: [DrawShapeUtil],
	tools: [DrawTool, HighlightTool],
	shortcuts: { d: 'draw', p: 'draw', m: 'highlight' }
};

export const geoPlugin: DrawPlugin = {
	name: 'geo',
	shapes: [GeoShapeUtil],
	tools: [RectangleTool, EllipseTool, ...GEO_TOOLS],
	shortcuts: { r: 'rectangle', o: 'ellipse' }
};

export const textPlugin: DrawPlugin = {
	name: 'text',
	shapes: [TextShapeUtil],
	tools: [TextTool],
	shortcuts: { t: 'text' }
};

/** Groups: no tool, only the kind; the editor's `groupSelection` makes them. */
export const groupPlugin: DrawPlugin = { name: 'group', shapes: [GroupShapeUtil] };

export const framePlugin: DrawPlugin = {
	name: 'frame',
	shapes: [FrameShapeUtil],
	tools: [FrameTool],
	shortcuts: { f: 'frame' }
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
	eraserPlugin,
	geoPlugin,
	linePlugin,
	textPlugin,
	framePlugin,
	groupPlugin
];
