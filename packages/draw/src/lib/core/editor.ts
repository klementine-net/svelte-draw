/*
 * The editor: one object that owns the document (store, history), the view (camera, selection)
 * and the tools (the state tree). The renderer reads from it and sends it events; a plugin adds
 * shape kinds and tools to it; a script can drive it with the same methods a tool uses.
 */

import { atom } from './signal.ts';
import { vec, type Box, type Vec } from './geometry.ts';
import { byIndex, indexBetween } from './indexing.ts';
import {
	createId,
	DEFAULT_STYLE,
	SCHEMA_VERSION,
	type AssetRecord,
	type DrawRecord,
	type PageRecord,
	type ShapeRecord,
	type ShapeStyle
} from './records.ts';
import { Store } from './store.ts';
import { History } from './history.ts';
import type { ShapeHandle, ShapeUtil } from './shape-util.ts';
import { StateNode } from './state-node.ts';
import type { DrawEvent, PointerInfo } from './events.ts';
import { DRAG_DISTANCE, EDGE_SPEED, EDGE_ZONE, type Handle } from './editor/constants.ts';
import type {
	AlignEdge,
	AssetStore,
	Camera,
	DocumentFile,
	EditorOptions,
	NewShape,
	Peer,
	ShapePatch,
	SnapLine
} from './editor/types.ts';
import { inlineAssets } from '../browser/assets.ts';
import * as Arrange from './editor/arrange.ts';
import * as View from './editor/view.ts';
import * as Content from './editor/content.ts';
import * as Frames from './editor/frames.ts';
import * as Groups from './editor/groups.ts';
import * as Selection from './editor/selection.ts';
import * as Snapping from './editor/snapping.ts';
import * as Space from './editor/space.ts';
import * as Tree from './editor/tree.ts';

export { GRID_SIZE, HANDLES, type Handle } from './editor/constants.ts';
export type {
	AlignEdge,
	AssetStore,
	Camera,
	DocumentFile,
	DrawPlugin,
	EditorOptions,
	NewShape,
	Peer,
	ShapePatch,
	SnapLine
} from './editor/types.ts';

class RootState extends StateNode {
	static override id = 'root';
}

export class Editor {
	readonly store: Store<DrawRecord>;
	readonly history: History<DrawRecord>;
	readonly root: StateNode;
	readonly assets: AssetStore;
	/** True while the document may be looked at but not changed (see `setReadOnly`). */
	readonly readOnly = atom(false);

	readonly camera = atom<Camera>({ x: 0, y: 0, z: 1 });
	/** The canvas's size on screen. */
	readonly viewport = atom({ w: 0, h: 0 });
	readonly pageId = atom('');
	readonly selection = atom<readonly string[]>([]);
	readonly hovered = atom<string | null>(null);
	/** The marquee, in page space, while one is being dragged. */
	readonly brush = atom<Box | null>(null);
	/** A CSS cursor name. */
	readonly cursor = atom('default');
	/** The style the next shape gets. */
	readonly style = atom<ShapeStyle>(DEFAULT_STYLE);
	/** The shape whose content is being typed into, if any (see `startEditing`). */
	readonly editing = atom<string | null>(null);
	/** The shapes the eraser has touched and will remove on release. */
	readonly erasing = atom<readonly string[]>([]);
	/** The group that was stepped into: clicks pick what is in it, not the group. */
	readonly focusedGroup = atom<string | null>(null);
	/** The guides shown while a move or a resize snaps to other shapes. */
	readonly snapLines = atom<readonly SnapLine[]>([]);
	/** The path of a lasso selection while it is drawn (page space). */
	readonly lasso = atom<readonly Vec[]>([]);
	/** The dot grid: whether it shows, and whether moved shapes land on it. This screen's own. */
	readonly grid = atom({ show: true, snap: false });
	/** The trail of the laser pointer (page space): shown for a moment, never part of the document. */
	readonly laser = atom<readonly Vec[]>([]);
	/** False while every shape must be on screen at once (a picture is being made of the page). */
	readonly culling = atom(true);
	/** Where this user's pointer is on the page (for the others to see). */
	readonly pointerPage = atom<Vec>({ x: 0, y: 0 });
	/** The other people looking at this document right now (see persist.ts). */
	readonly peers = atom<readonly Peer[]>([]);
	/** What was copied last, for a paste where the system clipboard cannot be read. */
	clipboard: ShapeRecord[] = [];
	/** The active path of the tool tree, like `select.idle`. */
	readonly toolPath = atom('');

	/** The pointer and modifier keys as of the last event. */
	readonly inputs = {
		screen: { x: 0, y: 0 } as Vec,
		page: { x: 0, y: 0 } as Vec,
		originScreen: { x: 0, y: 0 } as Vec,
		originPage: { x: 0, y: 0 } as Vec,
		shift: false,
		alt: false,
		meta: false,
		isDown: false,
		isDragging: false,
		pressure: 0.5,
		isPen: false
	};

	#utils = new Map<string, ShapeUtil>();
	#measured = new Map<string, ReturnType<typeof atom<{ w: number; h: number } | undefined>>>();
	#shortcuts = new Map<string, string>();
	/** The current page's shape ids, bottom to top, children after their parent. */
	#shapeIds = atom<readonly string[]>([]);
	#panning = false;

	constructor(options: EditorOptions) {
		this.store = options.store ?? new Store<DrawRecord>();
		this.history = new History(this.store);
		this.assets = options.assets ?? inlineAssets;
		this.root = new RootState(this);

		for (const plugin of options.plugins) {
			for (const Util of plugin.shapes ?? []) {
				if (this.#utils.has(Util.kind)) throw new Error(`Shape "${Util.kind}" is registered twice`);
				this.#utils.set(Util.kind, new Util(this));
			}
			for (const Tool of plugin.tools ?? []) this.root.addChild(Tool);
			for (const [key, tool] of Object.entries(plugin.shortcuts ?? {}))
				this.#shortcuts.set(key, tool);
		}

		this.pageId.set(this.#firstPage().id);

		this.#refreshShapeIds();
		this.store.listen((diff) => {
			this.#refreshShapeIds();
			// Whatever was removed (by undo, or by someone else) can no longer be selected.
			const gone = Object.keys(diff.removed);
			if (gone.length > 0) {
				const selection = this.selection.peek();
				if (selection.some((id) => gone.includes(id)))
					this.selection.set(selection.filter((id) => !gone.includes(id)));
				const hovered = this.hovered.peek();
				if (hovered && gone.includes(hovered)) this.hovered.set(null);
				const editing = this.editing.peek();
				if (editing && gone.includes(editing)) this.stopEditing();
				const focused = this.focusedGroup.peek();
				if (focused && gone.includes(focused)) this.focusedGroup.set(null);
				// The page being looked at is gone (deleted in another tab, or by an undo).
				if (gone.includes(this.pageId.peek())) this.setPage(this.#firstPage().id);
			}
		});

		this.root.enter(undefined);
		this.setTool(options.initialTool ?? 'select');
	}

	// ── Document and pages ──────────────────────────────────────────────────────────────────

	/** The first page. A document always has one: it is made here if there is none. */
	#firstPage(): PageRecord {
		const [first] = this.getPages();
		if (first) return first;
		// Made as a remote change, so it is not an undo step. Its id is fixed, so two tabs that
		// both start empty make the same page.
		const page: PageRecord = {
			id: 'page:main',
			type: 'page',
			name: 'Page 1',
			index: indexBetween()
		};
		this.store.put([page], 'remote');
		return page;
	}

	/** The document's pages, in order. */
	getPages(): PageRecord[] {
		return this.store
			.all()
			.filter((record): record is PageRecord => record.type === 'page')
			.sort(byIndex);
	}

	/** The page being looked at. */
	getPage(): PageRecord | undefined {
		const page = this.store.get(this.pageId.get());
		return page?.type === 'page' ? page : undefined;
	}

	#cameras = new Map<string, Camera>();

	/** Shows another page. What was going on is dropped; each page keeps its own view. */
	setPage(id: string) {
		const page = this.store.get(id);
		if (page?.type !== 'page' || id === this.pageId.peek()) return;
		if (this.editing.peek()) this.stopEditing();
		this.dispatch({ type: 'cancel' });
		this.selection.set([]);
		this.hovered.set(null);
		this.focusedGroup.set(null);
		this.#cameras.set(this.pageId.peek(), this.camera.peek());
		this.pageId.set(id);
		this.camera.set(this.#cameras.get(id) ?? { x: 0, y: 0, z: 1 });
		this.#refreshShapeIds();
	}

	/** Adds a page after the last one and shows it. */
	createPage(name?: string): PageRecord {
		if (this.readOnly.peek()) return this.getPage()!;
		const pages = this.getPages();
		const page: PageRecord = {
			id: createId('page'),
			type: 'page',
			name: name ?? `Page ${pages.length + 1}`,
			index: indexBetween(pages.at(-1)?.index)
		};
		this.history.mark();
		this.store.put([page]);
		this.history.mark();
		this.setPage(page.id);
		return page;
	}

	renamePage(id: string, name: string) {
		if (this.readOnly.peek()) return;
		const page = this.store.get(id);
		if (page?.type !== 'page' || !name.trim() || name === page.name) return;
		this.history.mark();
		this.store.put([{ ...page, name: name.trim() }]);
		this.history.mark();
	}

	/** Removes a page and everything on it. The last page stays. */
	deletePage(id: string) {
		if (this.readOnly.peek()) return;
		const pages = this.getPages();
		const at = pages.findIndex((page) => page.id === id);
		if (at < 0 || pages.length < 2) return;
		// Everything on the page: what names it as parent, and what sits in that.
		const doomed = new Set([id]);
		let grew = true;
		const shapes = this.store.snapshot().filter((record) => record.type === 'shape');
		while (grew) {
			grew = false;
			for (const shape of shapes)
				if (doomed.has(shape.parentId) && !doomed.has(shape.id)) {
					doomed.add(shape.id);
					grew = true;
				}
		}
		if (id === this.pageId.peek()) this.setPage((pages[at + 1] ?? pages[at - 1]).id);
		this.history.mark();
		this.store.remove([...doomed]);
		this.history.mark();
	}

	/** The whole document, to save to a file or hand to another editor. */
	getDocument(): DocumentFile {
		return { version: SCHEMA_VERSION, records: this.store.snapshot() };
	}

	/**
	 * Replaces the document with `records`. What is loaded is not an undo step. As `remote`
	 * (what storage held: the other tabs loaded it too) nothing is saved or sent for it; as
	 * `user` (a file this user opened) it is saved and sent like any other change.
	 */
	loadDocument(records: readonly DrawRecord[], source: 'user' | 'remote' = 'remote') {
		if (this.editing.peek()) this.stopEditing();
		this.dispatch({ type: 'cancel' });
		this.store.transact(() => {
			this.store.remove(
				this.store.snapshot().map((record) => record.id),
				source
			);
			this.store.put([...records], source);
		}, source);
		this.history.clear();
		this.#cameras.clear();
		this.selection.set([]);
		this.focusedGroup.set(null);
		this.pageId.set(this.#firstPage().id);
		this.#refreshShapeIds();
	}

	/** While read-only, tools other than select and hand are refused and nothing can be changed. */
	setReadOnly(readOnly: boolean) {
		this.readOnly.set(readOnly);
		if (readOnly) this.setTool('hand');
	}

	// ── Tools ───────────────────────────────────────────────────────────────────────────────

	/** The active tool's id (`select`, `draw`, …). */
	get tool(): string {
		return this.toolPath.get().split('.')[0];
	}

	/** Switches tool. `path` may reach into the tool (`select.resizing`), `info` goes with it. */
	setTool(path: string, info?: unknown) {
		// Read-only: the view can be moved, nothing else.
		if (this.readOnly.peek() && path.split('.')[0] !== 'hand') return;
		this.root.transition(path, info);
	}

	/** The one way events come in. */
	dispatch(event: DrawEvent): void {
		const { inputs } = this;
		if (event.type !== 'cancel') {
			inputs.shift = event.shift;
			inputs.alt = event.alt;
			inputs.meta = event.meta;
		}

		if (event.type === 'wheel') {
			if (event.meta) {
				// A mouse wheel reports a notch as 100 or more; capped, a notch is about a quarter step.
				const delta = Math.max(-25, Math.min(25, event.delta.y));
				this.zoomTo(this.camera.peek().z * Math.exp(-delta * 0.01), event.point);
			} else this.pan(-event.delta.x, -event.delta.y);
			this.#movePointer(event.point);
			return;
		}

		// A double click comes after its two presses and releases: it is no press of its own.
		if (event.type === 'double_click') {
			this.#movePointer(event.point);
			this.root.handleEvent(event);
			return;
		}

		if (event.type === 'pointer') {
			const previous = inputs.screen;
			this.#movePointer(event.point);
			inputs.pressure = event.pressure;
			inputs.isPen = event.isPen;

			// The middle button pans from any tool, and never reaches the tool.
			if (this.#panning) {
				if (event.name === 'move') this.pan(event.point.x - previous.x, event.point.y - previous.y);
				if (event.name === 'up') this.#panning = false;
				return;
			}
			if (event.name === 'down' && event.button === 1) {
				this.#panning = true;
				return;
			}

			if (event.name === 'down') {
				inputs.originScreen = inputs.screen;
				inputs.originPage = inputs.page;
				inputs.isDown = true;
				inputs.isDragging = false;
			} else if (event.name === 'move') {
				if (
					inputs.isDown &&
					!inputs.isDragging &&
					vec.dist(inputs.screen, inputs.originScreen) > DRAG_DISTANCE
				)
					inputs.isDragging = true;
			}
			this.root.handleEvent(event);
			if (event.name === 'up') {
				inputs.isDown = false;
				inputs.isDragging = false;
				this.#stopEdgeScroll();
			} else if (event.name === 'move' && inputs.isDragging) this.#edgeScroll(event);
			return;
		}

		// While a shape is typed into, the keys are the text's. Only Escape still ends it.
		if (event.type === 'key' && this.editing.peek() && event.key !== 'Escape') return;

		if (event.type === 'key' && event.name === 'down') {
			const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
			if (key === 'Escape') return this.dispatch({ type: 'cancel' });
			if (event.meta && key === 'z') return event.shift ? this.redo() : this.undo();
			if (event.meta && key === 'y') return this.redo();
			const tool = this.#shortcuts.get(key);
			if (tool && !event.meta && !event.alt && !event.repeat && !inputs.isDown)
				return this.setTool(tool);
		}

		if (event.type === 'cancel') {
			inputs.isDown = false;
			inputs.isDragging = false;
			this.#panning = false;
			this.#stopEdgeScroll();
		}
		this.root.handleEvent(event);
	}

	#edgeTimer: ReturnType<typeof setInterval> | undefined;

	/** How fast the view should move (screen px per tick) for a pointer this close to its edge. */
	#edgeSpeed(): Vec {
		const { w, h } = this.viewport.peek();
		const { x, y } = this.inputs.screen;
		const along = (at: number, size: number) => {
			if (size === 0) return 0;
			if (at < EDGE_ZONE) return Math.min(1, (EDGE_ZONE - at) / EDGE_ZONE) * EDGE_SPEED;
			if (at > size - EDGE_ZONE)
				return -Math.min(1, (at - size + EDGE_ZONE) / EDGE_ZONE) * EDGE_SPEED;
			return 0;
		};
		return { x: along(x, w), y: along(y, h) };
	}

	/**
	 * A drag that reaches the edge of the canvas moves the view, so what is dragged can go
	 * further than the screen. The tool sees it as the pointer moving over the page.
	 */
	#edgeScroll(event: PointerInfo) {
		const speed = this.#edgeSpeed();
		// Only for the select tool's drags (a new shape is dragged out by it too): a pen stroke
		// or the eraser near the edge should not move the view.
		if (this.#edgeTimer !== undefined || this.tool !== 'select' || (speed.x === 0 && speed.y === 0))
			return;
		this.#edgeTimer = setInterval(() => {
			const now = this.#edgeSpeed();
			if (!this.inputs.isDown || (now.x === 0 && now.y === 0)) return this.#stopEdgeScroll();
			this.pan(now.x, now.y);
			this.#movePointer(this.inputs.screen);
			this.root.handleEvent({ ...event, point: this.inputs.screen });
		}, 16);
		(this.#edgeTimer as { unref?: () => void }).unref?.();
	}

	#stopEdgeScroll() {
		if (this.#edgeTimer === undefined) return;
		clearInterval(this.#edgeTimer);
		this.#edgeTimer = undefined;
	}

	#movePointer(screen: Vec) {
		this.inputs.screen = screen;
		this.inputs.page = this.screenToPage(screen);
		this.pointerPage.set(this.inputs.page);
	}

	// ── Measured sizes ──────────────────────────────────────────────────────────────────────

	/**
	 * The size the renderer measured for a shape whose size the core cannot know (text). It is
	 * not part of the document: every screen measures its own, so nothing is written, undone or
	 * sent for it. Undefined where nothing has measured (a test, a server).
	 */
	getMeasured(id: string): { w: number; h: number } | undefined {
		let size = this.#measured.get(id);
		if (!size)
			this.#measured.set(id, (size = atom<{ w: number; h: number } | undefined>(undefined)));
		return size.get();
	}

	/** Called by a shape's view with what it measured; undefined when the view goes away. */
	setMeasured(id: string, size: { w: number; h: number } | undefined) {
		const current = this.#measured.get(id);
		const before = current?.peek();
		if (before?.w === size?.w && before?.h === size?.h) return;
		if (current) current.set(size);
		else this.#measured.set(id, atom(size));
	}

	// ── Editing ─────────────────────────────────────────────────────────────────────────────

	/** Whether the shape's content can be typed into (its util says so). */
	canEdit(id: string): boolean {
		const shape = this.getShape(id);
		return !!shape && this.util(shape.kind).canEdit(shape);
	}

	/**
	 * Starts typing into a shape: selects it and sets `editing`, which the shape's view turns
	 * into a text field. Everything typed until `stopEditing` is one undo step.
	 */
	startEditing(id: string, options: { creating?: boolean } = {}) {
		if (!this.canEdit(id)) return;
		this.select([id]);
		// `creating`: the shape was just made, and making and typing are one undo step.
		this.setTool('select.editing', { id, creating: options.creating });
	}

	/** Ends typing and keeps what was typed. The shape stays selected. */
	stopEditing() {
		if (this.editing.peek()) this.setTool('select');
	}

	// ── Shapes ──────────────────────────────────────────────────────────────────────────────

	/** The util that owns shapes of `kind`. */
	util<S extends ShapeRecord = ShapeRecord>(kind: string): ShapeUtil<S> {
		const util = this.#utils.get(kind);
		if (!util) throw new Error(`No shape util for "${kind}". Is its plugin registered?`);
		return util as unknown as ShapeUtil<S>;
	}

	/** Every registered kind with its util, in the order the plugins brought them. */
	getUtils(): ReadonlyMap<string, ShapeUtil> {
		return this.#utils;
	}

	hasUtil(kind: string): boolean {
		return this.#utils.has(kind);
	}

	getShape<S extends ShapeRecord = ShapeRecord>(id: string): S | undefined {
		const record = this.store.get(id);
		return record?.type === 'shape' ? (record as S) : undefined;
	}

	/** The current page's shape ids, bottom to top. */
	getShapeIds(): readonly string[] {
		return this.#shapeIds.get();
	}

	/** The current page's shapes, bottom to top. */
	getShapes(): ShapeRecord[] {
		return this.getShapeIds()
			.map((id) => this.getShape(id))
			.filter((shape) => shape !== undefined);
	}

	getSelectedShapes(): ShapeRecord[] {
		return this.selection
			.get()
			.map((id) => this.getShape(id))
			.filter((shape) => shape !== undefined);
	}

	createShape(shape: NewShape): ShapeRecord {
		return this.createShapes([shape])[0];
	}

	createShapes(shapes: NewShape[]): ShapeRecord[] {
		const tops = new Map<string, string | undefined>();
		const records = shapes.map((shape): ShapeRecord => {
			const parentId = shape.parentId ?? this.pageId.peek();
			if (!tops.has(parentId)) tops.set(parentId, Tree.topIndex(this, parentId));
			const index = shape.index ?? indexBetween(tops.get(parentId));
			if (!shape.index) tops.set(parentId, index);
			return {
				id: shape.id ?? createId('shape'),
				type: 'shape',
				kind: shape.kind,
				parentId,
				index,
				x: shape.x,
				y: shape.y,
				...(shape.rotation ? { rotation: shape.rotation } : {}),
				style: { ...this.style.peek(), ...shape.style },
				props: { ...(this.util(shape.kind).defaultProps() as object), ...shape.props }
			};
		});
		this.store.put(records);
		return records;
	}

	updateShape(id: string, patch: ShapePatch) {
		this.updateShapes([{ id, ...patch }]);
	}

	/** Patches shapes in one change. `props` and `style` are merged into what is there. */
	updateShapes(patches: ({ id: string } & ShapePatch)[]) {
		const next: ShapeRecord[] = [];
		for (const { id, props, style, ...rest } of patches) {
			const shape = this.getShape(id);
			if (!shape) continue;
			next.push({
				...shape,
				...rest,
				props: props ? { ...shape.props, ...props } : shape.props,
				style: style ? { ...shape.style, ...style } : shape.style
			});
		}
		this.store.put(next);
	}

	/** Removes the shapes and everything inside them. */
	deleteShapes(ids: readonly string[]) {
		const doomed = new Set(ids);
		// Shape ids come parent first, so one pass catches every descendant.
		const shapes = this.getShapes();
		for (const shape of shapes) if (doomed.has(shape.parentId)) doomed.add(shape.id);
		// A group with nothing left in it goes too (innermost first: ids come parent first).
		for (let i = shapes.length - 1; i >= 0; i--) {
			const shape = shapes[i];
			if (doomed.has(shape.id) || !this.util(shape.kind).group) continue;
			const children = this.getChildren(shape.id);
			if (children.length > 0 && children.every((child) => doomed.has(child.id)))
				doomed.add(shape.id);
		}
		this.store.transact(() => {
			// What was tied to a removed shape (an arrow attached to it) stays where it shows.
			const patches = this.getShapes().flatMap((shape) => {
				if (doomed.has(shape.id)) return [];
				const patch = this.util(shape.kind).retie(shape, (id) => (doomed.has(id) ? null : id));
				return patch ? [{ id: shape.id, ...patch }] : [];
			});
			if (patches.length > 0) this.updateShapes(patches);
			this.store.remove([...doomed]);
		});
	}

	/**
	 * Cuts the ties from `ids` to shapes outside of `ids`: an attached arrow that is moved
	 * without its shape lets go of it, and stays where it shows.
	 */
	releaseTies(ids: readonly string[] = this.selection.peek()) {
		// What is in a moving group or frame moves along: it is neither let go of nor lets go.
		const together = new Set(ids);
		const shapes = this.getShapes();
		for (const shape of shapes) if (together.has(shape.parentId)) together.add(shape.id);
		const patches = shapes.flatMap((shape) => {
			if (!together.has(shape.id)) return [];
			const patch = this.util(shape.kind).retie(shape, (tie) => (together.has(tie) ? tie : null));
			return patch ? [{ id: shape.id, ...patch }] : [];
		});
		if (patches.length > 0) this.updateShapes(patches);
	}

	/**
	 * The topmost shape a line's end at `point` (page space) attaches to. By its box, not its
	 * line: a hollow shape is a target all over.
	 */
	getBindTargetAt(
		point: Vec,
		exclude: readonly (string | null | undefined)[] = []
	): ShapeRecord | undefined {
		return Space.getBindTargetAt(this, point, exclude);
	}

	/** The shapes directly in `parentId` (a page, a group, a frame), bottom to top. */
	getChildren(parentId: string): ShapeRecord[] {
		return Tree.siblings(this, parentId);
	}

	/** The shapes with every group among them replaced by what is in it. */
	getLeaves(shapes: readonly ShapeRecord[]): ShapeRecord[] {
		return Tree.getLeaves(this, shapes);
	}

	/** Whether the shape, or anything it sits in, is locked. */
	isLocked(shape: ShapeRecord): boolean {
		return Tree.isLocked(this, shape);
	}

	/** How far the shape is turned on the page: its own turn plus every parent's. */
	getShapePageRotation(shape: ShapeRecord): number {
		return Space.getShapePageRotation(this, shape);
	}

	/** A point in the shape's own space, as a point on the page. */
	shapeToPage(shape: ShapeRecord, point: Vec): Vec {
		return Space.shapeToPage(this, shape, point);
	}

	/** A point on the page, as a point in the shape's own space. */
	pageToShape(shape: ShapeRecord, point: Vec): Vec {
		return Space.pageToShape(this, shape, point);
	}

	/** A point on the page, in the space the shape's `x`/`y` are in (its parent's). */
	pageToParent(shape: ShapeRecord, point: Vec): Vec {
		return Space.pageToParent(this, shape, point);
	}

	/** Where the shape's origin is on the page. */
	getShapePageOrigin(shape: ShapeRecord): Vec {
		return Space.getShapePageOrigin(this, shape);
	}

	/** The upright box around the shape on the page (around its corners, if it is turned). */
	getShapePageBounds(shape: ShapeRecord): Box {
		return Space.getShapePageBounds(this, shape);
	}

	/**
	 * The topmost shape touching `point` (page space), or undefined. Locked shapes are passed
	 * over unless `locked` is set; what a frame cuts off is not there.
	 */
	getShapeAtPoint(point: Vec, options: { locked?: boolean } = {}): ShapeRecord | undefined {
		return Space.getShapeAtPoint(this, point, options);
	}

	/**
	 * What a click on `shape` picks: the outermost group it is in, up to the group that was
	 * stepped into (`focusedGroup`); the shape itself when it is in no group.
	 */
	getSelectable(shape: ShapeRecord): ShapeRecord {
		return Tree.getSelectable(this, shape);
	}

	/** Whether the shape is in the group that was stepped into (always, when none was). */
	isInFocus(shape: ShapeRecord): boolean {
		return Tree.isInFocus(this, shape);
	}

	/** Every shape whose bounds touch `area` (page space). */
	getShapesInBox(area: Box): ShapeRecord[] {
		return Space.getShapesInBox(this, area);
	}

	bringToFront(ids: readonly string[] = this.selection.peek()) {
		Arrange.restack(this, ids, 'front');
	}

	sendToBack(ids: readonly string[] = this.selection.peek()) {
		Arrange.restack(this, ids, 'back');
	}

	/** One step up: above the next sibling that is not moving too. */
	bringForward(ids: readonly string[] = this.selection.peek()) {
		Arrange.restack(this, ids, 'forward');
	}

	/** One step down. */
	sendBackward(ids: readonly string[] = this.selection.peek()) {
		Arrange.restack(this, ids, 'backward');
	}

	#refreshShapeIds() {
		const byParent = new Map<string, ShapeRecord[]>();
		for (const record of this.store.snapshot()) {
			// A kind no plugin here knows (a document from a newer app) is left out, not a crash.
			if (record.type !== 'shape' || !this.#utils.has(record.kind)) continue;
			const list = byParent.get(record.parentId);
			if (list) list.push(record);
			else byParent.set(record.parentId, [record]);
		}
		const ids: string[] = [];
		const walk = (parentId: string) => {
			for (const shape of (byParent.get(parentId) ?? []).sort(byIndex)) {
				ids.push(shape.id);
				walk(shape.id);
			}
		};
		walk(this.pageId.peek());
		const previous = this.#shapeIds.peek();
		if (ids.length !== previous.length || ids.some((id, i) => id !== previous[i]))
			this.#shapeIds.set(ids);
	}

	// ── Selection ───────────────────────────────────────────────────────────────────────────

	select(ids: readonly string[]) {
		const current = this.selection.peek();
		if (ids.length === current.length && ids.every((id, i) => id === current[i])) return;
		this.selection.set([...ids]);
	}

	/** Selects everything that can be picked (groups as one, locked shapes not at all). */
	selectAll() {
		return Selection.selectAll(this);
	}

	/** The selected shapes that are not inside another selected shape, and not locked. */
	getSelectionRoots(): ShapeRecord[] {
		return Selection.getSelectionRoots(this);
	}

	/** The upright box around everything selected (page space), or undefined. */
	getSelectionBounds(): Box | undefined {
		return Selection.getSelectionBounds(this);
	}

	/**
	 * The box the selection's handles sit on. `bounds` is in the page turned back by
	 * `rotation`: one turned shape keeps its own box, several shapes get an upright one.
	 */
	getSelectionFrame(): { rotation: number; bounds: Box } | undefined {
		return Selection.getSelectionFrame(this);
	}

	/**
	 * Whether the selection shows resize handles: nothing in it is locked, all of it resizes,
	 * and all of it is turned the same way as the box the handles sit on.
	 */
	canResizeSelection(): boolean {
		return Selection.canResizeSelection(this);
	}

	/** Whether the selection shows the handle that turns it. */
	canRotateSelection(): boolean {
		return Selection.canRotateSelection(this);
	}

	/** Where the handle that turns the selection sits (page space): above its top edge. */
	getRotateHandle(): Vec | null {
		return Selection.getRotateHandle(this);
	}

	isRotateHandleAt(screen: Vec): boolean {
		return Selection.isRotateHandleAt(this, screen);
	}

	/**
	 * The change that puts `shape`'s box at `target`, a box in the page turned back by
	 * `rotation` (which is how far the shape itself is turned on the page).
	 */
	getResizePatch(
		shape: ShapeRecord,
		target: Box,
		rotation: number,
		flip: { x: boolean; y: boolean }
	): { id: string } & ShapePatch {
		return Selection.getResizePatch(this, shape, target, rotation, flip);
	}

	/**
	 * The handles of the one selected shape, in page space, when its kind has its own (a line's
	 * two ends). Null otherwise.
	 */
	getShapeHandles(): { shape: ShapeRecord; handles: ShapeHandle[] } | null {
		return Selection.getShapeHandles(this);
	}

	/** The id of the selected shape's own handle under `screen`, if any. */
	getShapeHandleAt(screen: Vec): string | null {
		return Selection.getShapeHandleAt(this, screen);
	}

	/** The resize handle under `screen`, if the selection has handles there. */
	getHandleAt(screen: Vec): Handle | null {
		return Selection.getHandleAt(this, screen);
	}

	deleteSelection() {
		return Arrange.deleteSelection(this);
	}

	/**
	 * The shapes, and all that is in them, as records that stand on their own: placed on the
	 * page, tied only to each other. This is what goes on the clipboard.
	 */
	getContent(ids: readonly string[] = this.selection.peek()): ShapeRecord[] {
		return Content.getContent(this, ids);
	}

	/** The asset records the shapes show (an image's file), for a clipboard that leaves the tab. */
	getContentAssets(content: readonly ShapeRecord[]): AssetRecord[] {
		return Content.getContentAssets(this, content);
	}

	/**
	 * Adds content (from `getContent`) to the page as new shapes and selects them. With `at`
	 * its middle lands on that page point; otherwise it lands `offset` down and right of where
	 * it came from. `assets` are the files the shapes show, added where this document lacks them.
	 */
	putContent(
		content: readonly ShapeRecord[],
		options: { at?: Vec; offset?: number; assets?: readonly AssetRecord[] } = {}
	): ShapeRecord[] {
		return Content.putContent(this, content, options);
	}

	/** Copies the selection a little down and right (or `offset` away), and selects the copies. */
	duplicateSelection(offset = 16) {
		return Content.duplicateSelection(this, offset);
	}

	/** Puts the selection on the clipboard the editor keeps (`clipboard`), and returns it. */
	copy(): ShapeRecord[] {
		return Content.copy(this);
	}

	cut(): ShapeRecord[] {
		return Content.cut(this);
	}

	/** Pastes content (the editor's own clipboard by default), its middle at `at` if given. */
	paste(
		content: readonly ShapeRecord[] = this.clipboard,
		at?: Vec,
		assets?: readonly AssetRecord[]
	) {
		return Content.paste(this, content, at, assets);
	}

	/**
	 * Pastes plain text as a shape, its middle at `at`: the first kind that says it is made
	 * from text (`ShapeUtil.fromText`) makes it. Nothing happens when no kind does.
	 */
	pasteText(text: string, at: Vec) {
		return Content.pasteText(this, text, at);
	}

	/**
	 * Adds dropped, pasted or picked files as shapes around `at`: for each file, the first kind
	 * that says it is made from it (`ShapeUtil.fromFile`) makes the shape. Other files are
	 * passed over. All of it is one undo step.
	 */
	async addFiles(files: readonly Blob[], at: Vec): Promise<ShapeRecord[]> {
		return Content.addFiles(this, files, at);
	}

	/** Flips a switch (`ShapeUtil.toggles`) on every selected shape that has it. */
	toggleSelection(id: string) {
		return Arrange.toggleSelection(this, id);
	}

	/** Moves the selection by a step (the arrow keys). */
	nudgeSelection(dx: number, dy: number) {
		return Arrange.nudgeSelection(this, dx, dy);
	}

	/** Lines the selected shapes up along one edge (or the middle) of the box around them. */
	alignSelection(edge: AlignEdge) {
		return Arrange.alignSelection(this, edge);
	}

	/** Spreads three or more selected shapes so the gaps between them are equal. */
	distributeSelection(axis: 'x' | 'y') {
		return Arrange.distributeSelection(this, axis);
	}

	/** Mirrors the selection left to right (`x`) or top to bottom (`y`) within its box. */
	flipSelection(axis: 'x' | 'y') {
		return Arrange.flipSelection(this, axis);
	}

	/** Locks the selection, or unlocks it when all of it is locked. A locked shape lets go. */
	toggleLock() {
		return Arrange.toggleLock(this);
	}

	/** Whether the selection can be made a group: two or more shapes with the same parent. */
	canGroupSelection(): boolean {
		return Groups.canGroupSelection(this);
	}

	/** Makes the selected shapes one group, in the place of the topmost of them. */
	groupSelection() {
		return Groups.groupSelection(this);
	}

	/** Takes the selected groups apart; what was in them stays where it shows. */
	ungroupSelection() {
		return Groups.ungroupSelection(this);
	}

	/**
	 * After shapes were made or moved: each whose middle now lies on a frame becomes that
	 * frame's, each that left its frame becomes the page's. It stays where it shows.
	 */
	settle(ids: readonly string[] = this.selection.peek()) {
		return Frames.settle(this, ids);
	}

	/**
	 * How far to shift `moving` (a box on the page) so that one of its edges or its middle
	 * meets another shape's. Shows the guides for it in `snapLines`.
	 */
	snapBox(moving: Box, exclude: ReadonlySet<string>): Vec {
		return Snapping.snapBox(this, moving, exclude);
	}

	/** `point` moved onto another shape's edge or middle where one is near, on the given axes. */
	snapPoint(point: Vec, exclude: ReadonlySet<string>, axes: { x: boolean; y: boolean }): Vec {
		return Snapping.snapPoint(this, point, exclude, axes);
	}

	/** Sets a style on the selection (on what is in a selected group) and for the next shape. */
	setStyle(patch: Partial<ShapeStyle>) {
		return Arrange.setStyle(this, patch);
	}

	// ── Camera ──────────────────────────────────────────────────────────────────────────────

	screenToPage(point: Vec): Vec {
		return View.screenToPage(this, point);
	}

	pageToScreen(point: Vec): Vec {
		return View.pageToScreen(this, point);
	}

	/** Moves the view by screen pixels. */
	pan(dx: number, dy: number) {
		return View.pan(this, dx, dy);
	}

	/** Zooms to `zoom`, keeping the page point under `anchor` (screen; the centre by default) still. */
	zoomTo(zoom: number, anchor?: Vec) {
		return View.zoomTo(this, zoom, anchor);
	}

	zoomIn() {
		return View.zoomIn(this);
	}

	zoomOut() {
		return View.zoomOut(this);
	}

	resetZoom() {
		return View.resetZoom(this);
	}

	/** Fits every shape on the page into view (never closer than 100%). */
	zoomToFit() {
		return View.zoomToFit(this);
	}

	/** Brings a box on the page into view, as large as fits. */
	zoomToBounds(bounds: Box, padding = 32) {
		return View.zoomToBounds(this, bounds, padding);
	}

	/** The part of the page that is on screen. */
	getViewportPageBounds(): Box {
		return View.getViewportPageBounds(this);
	}

	/** Brings the selection into view, as large as fits (never past 100%). */
	zoomToSelection() {
		return View.zoomToSelection(this);
	}

	// ── History ─────────────────────────────────────────────────────────────────────────────

	undo() {
		if (this.readOnly.peek()) return;
		this.stopEditing();
		this.dispatchCancelIfBusy();
		this.history.undo();
	}

	redo() {
		if (this.readOnly.peek()) return;
		this.stopEditing();
		this.dispatchCancelIfBusy();
		this.history.redo();
	}

	/** An undo in the middle of a drag first drops the drag. */
	private dispatchCancelIfBusy() {
		if (this.inputs.isDown) this.dispatch({ type: 'cancel' });
	}
}

/** A pointer event with the fields a test or script rarely cares about filled in. */
export function pointer(
	name: PointerInfo['name'],
	point: Vec,
	options: Partial<Omit<PointerInfo, 'name' | 'point'>> = {}
): PointerInfo {
	return {
		type: 'pointer',
		name,
		point,
		button: 0,
		pressure: 0.5,
		isPen: false,
		shift: false,
		alt: false,
		meta: false,
		...options
	};
}
