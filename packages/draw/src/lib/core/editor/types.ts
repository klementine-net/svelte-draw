/* The shapes of what goes into and comes out of the editor. */

import type { Vec } from '../geometry.ts';
import type { DrawRecord, ShapeRecord, ShapeStyle } from '../records.ts';
import type { Store } from '../store.ts';
import type { ShapeUtilConstructor } from '../shape-util.ts';
import type { StateNodeConstructor } from '../state-node.ts';

/** What a plugin brings: kinds of shapes, tools, and the keys that pick a tool. */
export interface DrawPlugin {
	name: string;
	shapes?: ShapeUtilConstructor[];
	tools?: StateNodeConstructor[];
	/** Key → tool id, e.g. `{ r: 'rectangle' }`. */
	shortcuts?: Record<string, string>;
}

export interface EditorOptions {
	plugins: DrawPlugin[];
	/** A store to edit (shared with sync, or loaded from a save). A fresh one by default. */
	store?: Store<DrawRecord>;
	/** The tool that is active first. `select` by default. */
	initialTool?: string;
	/** Where files (images) are kept. By default they stay in the document as data URLs. */
	assets?: AssetStore;
}

/**
 * Where the files of a document are kept. `upload` stores a file and answers what an `<img>`
 * can show it from. The default keeps the file in the document itself, as a data URL: nothing
 * to set up, and it is saved and synced with the rest. An app with a file store of its own
 * (Convex storage, a bucket) passes an `upload` that puts the file there and answers its link.
 */
export interface AssetStore {
	upload(file: Blob): Promise<string>;
}

/** Someone else looking at the document: who, where their pointer is, what they have picked. */
export interface Peer {
	id: string;
	name: string;
	/** A CSS colour for their cursor. */
	color: string;
	/** The page they are on. */
	pageId: string;
	cursor: Vec;
	selection: readonly string[];
	/** The trail of their laser pointer, if they are pointing something out. */
	laser?: readonly Vec[];
}

/** A document as it is saved to a file or handed to another editor. */
export interface DocumentFile {
	/** The version of the record shapes (`SCHEMA_VERSION` when it was written). */
	version: number;
	records: DrawRecord[];
}

/** Screen = page × z + (x, y). */
export interface Camera {
	x: number;
	y: number;
	z: number;
}

export interface NewShape {
	kind: string;
	x: number;
	y: number;
	id?: string;
	parentId?: string;
	/** Its place in the stacking order. On top of its siblings when left out. */
	index?: string;
	rotation?: number;
	props?: Record<string, unknown>;
	style?: Partial<ShapeStyle>;
}

export type ShapePatch = Partial<
	Pick<ShapeRecord, 'x' | 'y' | 'index' | 'parentId' | 'rotation' | 'locked'>
> & {
	props?: Record<string, unknown>;
	style?: Partial<ShapeStyle>;
};

/** A guide shown while something snaps: a line on the page. */
export interface SnapLine {
	from: Vec;
	to: Vec;
}

export type AlignEdge = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';
