/*
 * svelte-draw's engine on its own: `@klementine/svelte-draw/core`. Plain TypeScript, no UI
 * framework: it runs in a browser, in a test and on a server alike (only what is in `browser/`
 * needs a browser, and only when it is called). A Svelte app imports `@klementine/svelte-draw`
 * instead, which has all of this and the canvas.
 */

import type { DrawPlugin } from './core/editor.ts';
import { SelectTool } from './tools/select.ts';
import { HandTool } from './tools/hand.ts';
import { EraserTool } from './tools/eraser.ts';
import { LaserTool } from './tools/laser.ts';
import { ZoomTool } from './tools/zoom.ts';
import { DrawShapeUtil, DrawTool, HighlightTool } from './shapes/draw.ts';
import { EllipseTool, GEO_TOOLS, GeoShapeUtil, RectangleTool } from './shapes/geo.ts';
import { TextShapeUtil, TextTool } from './shapes/text.ts';
import { GroupShapeUtil } from './shapes/group.ts';
import { FrameShapeUtil, FrameTool } from './shapes/frame.ts';
import { ImageShapeUtil } from './shapes/image.ts';
import { LinkShapeUtil } from './shapes/link.ts';
import { NoteShapeUtil, NoteTool } from './shapes/note.ts';
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
export { inlineAssets } from './browser/assets.ts';
export { broadcastChannel } from './browser/channel.ts';
export { indexedDbStorage } from './browser/storage.ts';
export {
	migrate,
	persist,
	validRecords,
	presence,
	type Channel,
	type ChannelMessage,
	type DocumentStorage,
	type PersistOptions,
	type SavedDocument
} from './core/persist.ts';
export {
	Editor,
	GRID_SIZE,
	HANDLES,
	pointer,
	type AlignEdge,
	type AssetStore,
	type Camera,
	type DocumentFile,
	type DrawPlugin,
	type EditorOptions,
	type Handle,
	type NewShape,
	type Peer,
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
export { LaserTool } from './tools/laser.ts';
export { ZoomTool } from './tools/zoom.ts';
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
export { ImageShapeUtil, type ImageProps, type ImageShape } from './shapes/image.ts';
export { embedUrl, LinkShapeUtil, type LinkProps, type LinkShape } from './shapes/link.ts';
export { NoteShapeUtil, NoteTool, noteTilt, type NoteShape } from './shapes/note.ts';
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
	lineGeometry,
	type LineGeometry,
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

/*
 * The built-in plugins, without their views. `@klementine/svelte-draw` has them under the same
 * names with their views and their toolbar entries.
 */

export const selectPlugin: DrawPlugin = {
	name: 'select',
	tools: [SelectTool],
	shortcuts: { v: 'select' }
};

export const handPlugin: DrawPlugin = {
	name: 'hand',
	tools: [HandTool, ZoomTool],
	shortcuts: { h: 'hand', z: 'zoom' }
};

export const laserPlugin: DrawPlugin = {
	name: 'laser',
	tools: [LaserTool],
	shortcuts: { k: 'laser' }
};

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

export const notePlugin: DrawPlugin = {
	name: 'note',
	shapes: [NoteShapeUtil],
	tools: [NoteTool],
	shortcuts: { n: 'note' }
};

/** Images: no tool, only the kind; files that are dropped, pasted or picked make them. */
export const imagePlugin: DrawPlugin = { name: 'image', shapes: [ImageShapeUtil] };

/** Links: no tool, only the kind; a pasted web address makes one. */
export const linkPlugin: DrawPlugin = { name: 'link', shapes: [LinkShapeUtil] };

/**
 * The built-in plugins without views: for an editor that draws nothing (a server, a script, a
 * test). A Svelte app passes `defaultPlugins` instead.
 */
export const corePlugins: DrawPlugin[] = [
	selectPlugin,
	handPlugin,
	drawPlugin,
	laserPlugin,
	eraserPlugin,
	geoPlugin,
	linePlugin,
	// Before text: a pasted web address is a link, any other pasted text a text.
	linkPlugin,
	textPlugin,
	notePlugin,
	imagePlugin,
	framePlugin,
	groupPlugin
];
