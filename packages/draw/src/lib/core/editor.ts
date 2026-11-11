/*
 * The editor: one object that owns the document (store, history), the view (camera, selection)
 * and the tools (the state tree). The renderer reads from it and sends it events; a plugin adds
 * shape kinds and tools to it; a script can drive it with the same methods a tool uses.
 */

import { atom } from './signal.ts';
import { box, vec, type Box, type Vec } from './geometry.ts';
import { byIndex, indexBetween } from './indexing.ts';
import {
	createId,
	DEFAULT_STYLE,
	type DrawRecord,
	type PageRecord,
	type ShapeRecord,
	type ShapeStyle
} from './records.ts';
import { Store } from './store.ts';
import { History } from './history.ts';
import type { ShapeHandle, ShapeUtil, ShapeUtilConstructor } from './shape-util.ts';
import { StateNode, type StateNodeConstructor } from './state-node.ts';
import type { DrawEvent, PointerInfo } from './events.ts';

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
}

/** Screen = page × z + (x, y). */
export interface Camera {
	x: number;
	y: number;
	z: number;
}

export const HANDLES = [
	'top_left',
	'top_right',
	'bottom_right',
	'bottom_left',
	'top',
	'right',
	'bottom',
	'left'
] as const;
export type Handle = (typeof HANDLES)[number];

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

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 8;
const ZOOM_STEPS = [0.1, 0.25, 0.5, 1, 2, 4, 8];
/** How far the pointer travels (screen px) before a press counts as a drag. */
const DRAG_DISTANCE = 4;
/** How close (screen px) the pointer must be to grab a shape's edge or a handle. */
const HIT_MARGIN = 6;
/** How far above the selection (screen px) the handle that turns it sits. */
const ROTATE_HANDLE_DISTANCE = 24;
/** How close (screen px) an edge must come to another shape's to snap to it. */
const SNAP_DISTANCE = 7;

/** A guide shown while something snaps: a line on the page. */
export interface SnapLine {
	from: Vec;
	to: Vec;
}

export type AlignEdge = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';

/** An angle brought into (−π, π], with what is as good as zero made zero. */
function tidyAngle(angle: number): number {
	let a = angle % (Math.PI * 2);
	if (a > Math.PI) a -= Math.PI * 2;
	if (a <= -Math.PI) a += Math.PI * 2;
	return Math.abs(a) < 1e-9 ? 0 : a;
}

class RootState extends StateNode {
	static override id = 'root';
}

export class Editor {
	readonly store: Store<DrawRecord>;
	readonly history: History<DrawRecord>;
	readonly root: StateNode;

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

		// A document always has a page. Made as a remote change, so it is not an undo step.
		let page = this.store.snapshot().find((r): r is PageRecord => r.type === 'page');
		if (!page) {
			page = { id: 'page:main', type: 'page', name: 'Page 1', index: indexBetween() };
			this.store.put([page], 'remote');
		}
		this.pageId.set(page.id);

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
			}
		});

		this.root.enter(undefined);
		this.setTool(options.initialTool ?? 'select');
	}

	// ── Tools ───────────────────────────────────────────────────────────────────────────────

	/** The active tool's id (`select`, `draw`, …). */
	get tool(): string {
		return this.toolPath.get().split('.')[0];
	}

	/** Switches tool. `path` may reach into the tool (`select.resizing`), `info` goes with it. */
	setTool(path: string, info?: unknown) {
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
			}
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
		}
		this.root.handleEvent(event);
	}

	#movePointer(screen: Vec) {
		this.inputs.screen = screen;
		this.inputs.page = this.screenToPage(screen);
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
			if (!tops.has(parentId)) tops.set(parentId, this.#topIndex(parentId));
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
		const shapes = this.getShapes();
		for (let i = shapes.length - 1; i >= 0; i--) {
			const shape = shapes[i];
			const util = this.util(shape.kind);
			if (exclude.includes(shape.id) || !util.canBind(shape) || this.isLocked(shape)) continue;
			if (box.contains(util.bounds(shape), this.pageToShape(shape, point))) return shape;
		}
		return undefined;
	}

	/** The shapes directly in `parentId` (a page, a group, a frame), bottom to top. */
	getChildren(parentId: string): ShapeRecord[] {
		return this.#siblings(parentId);
	}

	/** The shapes with every group among them replaced by what is in it. */
	getLeaves(shapes: readonly ShapeRecord[]): ShapeRecord[] {
		return shapes.flatMap((shape) =>
			this.util(shape.kind).group ? this.getLeaves(this.getChildren(shape.id)) : [shape]
		);
	}

	/** Whether the shape, or anything it sits in, is locked. */
	isLocked(shape: ShapeRecord): boolean {
		for (let current: ShapeRecord | undefined = shape; current;)
			if (current.locked) return true;
			else current = this.getShape(current.parentId);
		return false;
	}

	/** How far the shape is turned on the page: its own turn plus every parent's. */
	getShapePageRotation(shape: ShapeRecord): number {
		let rotation = shape.rotation ?? 0;
		for (let parent = this.getShape(shape.parentId); parent;) {
			rotation += parent.rotation ?? 0;
			parent = this.getShape(parent.parentId);
		}
		return tidyAngle(rotation);
	}

	/** A point in the shape's own space, as a point on the page. */
	shapeToPage(shape: ShapeRecord, point: Vec): Vec {
		let p = point;
		for (let current: ShapeRecord | undefined = shape; current;) {
			p = vec.add(vec.rotate(p, current.rotation ?? 0), current);
			current = this.getShape(current.parentId);
		}
		return p;
	}

	/** A point on the page, as a point in the shape's own space. */
	pageToShape(shape: ShapeRecord, point: Vec): Vec {
		return vec.rotate(vec.sub(this.pageToParent(shape, point), shape), -(shape.rotation ?? 0));
	}

	/** A point on the page, in the space the shape's `x`/`y` are in (its parent's). */
	pageToParent(shape: ShapeRecord, point: Vec): Vec {
		const parent = this.getShape(shape.parentId);
		return parent ? this.pageToShape(parent, point) : point;
	}

	/** Where the shape's origin is on the page. */
	getShapePageOrigin(shape: ShapeRecord): Vec {
		return this.shapeToPage(shape, { x: 0, y: 0 });
	}

	/** The upright box around the shape on the page (around its corners, if it is turned). */
	getShapePageBounds(shape: ShapeRecord): Box {
		const bounds = this.util(shape.kind).bounds(shape);
		return box.around(box.corners(bounds).map((corner) => this.shapeToPage(shape, corner)));
	}

	/**
	 * The topmost shape touching `point` (page space), or undefined. Locked shapes are passed
	 * over unless `locked` is set; what a frame cuts off is not there.
	 */
	getShapeAtPoint(point: Vec, options: { locked?: boolean } = {}): ShapeRecord | undefined {
		const margin = HIT_MARGIN / this.camera.peek().z;
		const shapes = this.getShapes();
		for (let i = shapes.length - 1; i >= 0; i--) {
			const shape = shapes[i];
			if (!options.locked && this.isLocked(shape)) continue;
			if (!this.util(shape.kind).hitTest(shape, this.pageToShape(shape, point), margin)) continue;
			if (!this.#cutOff(shape, point)) return shape;
		}
		return undefined;
	}

	/** Whether `point` lies outside a frame the shape sits in, where the shape is not shown. */
	#cutOff(shape: ShapeRecord, point: Vec): boolean {
		for (let parent = this.getShape(shape.parentId); parent;) {
			const util = this.util(parent.kind);
			if (util.frame && !box.contains(util.bounds(parent), this.pageToShape(parent, point)))
				return true;
			parent = this.getShape(parent.parentId);
		}
		return false;
	}

	/**
	 * What a click on `shape` picks: the outermost group it is in, up to the group that was
	 * stepped into (`focusedGroup`); the shape itself when it is in no group.
	 */
	getSelectable(shape: ShapeRecord): ShapeRecord {
		const focus = this.focusedGroup.peek();
		let result = shape;
		for (let parent = this.getShape(shape.parentId); parent && parent.id !== focus;) {
			if (this.util(parent.kind).group) result = parent;
			parent = this.getShape(parent.parentId);
		}
		return result;
	}

	/** Whether the shape is in the group that was stepped into (always, when none was). */
	isInFocus(shape: ShapeRecord): boolean {
		const focus = this.focusedGroup.peek();
		if (!focus) return true;
		for (let parent = this.getShape(shape.parentId); parent;) {
			if (parent.id === focus) return true;
			parent = this.getShape(parent.parentId);
		}
		return false;
	}

	/** Every shape whose bounds touch `area` (page space). */
	getShapesInBox(area: Box): ShapeRecord[] {
		return this.getShapes().filter(
			(shape) => !this.isLocked(shape) && box.intersects(area, this.getShapePageBounds(shape))
		);
	}

	bringToFront(ids: readonly string[] = this.selection.peek()) {
		this.#restack(ids, 'front');
	}

	sendToBack(ids: readonly string[] = this.selection.peek()) {
		this.#restack(ids, 'back');
	}

	/** One step up: above the next sibling that is not moving too. */
	bringForward(ids: readonly string[] = this.selection.peek()) {
		this.#restack(ids, 'forward');
	}

	/** One step down. */
	sendBackward(ids: readonly string[] = this.selection.peek()) {
		this.#restack(ids, 'backward');
	}

	#restack(ids: readonly string[], where: 'front' | 'back' | 'forward' | 'backward') {
		const moving = this.getShapes().filter((shape) => ids.includes(shape.id));
		const up = where === 'front' || where === 'forward';
		if (up === (where === 'forward')) moving.reverse();
		this.history.mark();
		this.store.transact(() => {
			for (const shape of moving) {
				const siblings = this.#siblings(shape.parentId);
				const others = siblings.filter((s) => s.id !== shape.id);
				if (others.length === 0) continue;
				let index: string;
				if (where === 'front') index = indexBetween(others[others.length - 1].index);
				else if (where === 'back') index = indexBetween(undefined, others[0].index);
				else {
					// Past the nearest sibling in that direction that stays where it is.
					const at = siblings.findIndex((s) => s.id === shape.id);
					const step = up ? 1 : -1;
					let next = at + step;
					while (siblings[next] && ids.includes(siblings[next].id)) next += step;
					if (!siblings[next]) continue;
					const beyond = siblings[next + step];
					index = up
						? indexBetween(siblings[next].index, beyond?.index)
						: indexBetween(beyond?.index, siblings[next].index);
				}
				this.updateShape(shape.id, { index });
			}
		});
	}

	#siblings(parentId: string): ShapeRecord[] {
		return this.store
			.snapshot()
			.filter((r): r is ShapeRecord => r.type === 'shape' && r.parentId === parentId)
			.sort(byIndex);
	}

	#topIndex(parentId: string): string | undefined {
		return this.#siblings(parentId).at(-1)?.index;
	}

	#refreshShapeIds() {
		const byParent = new Map<string, ShapeRecord[]>();
		for (const record of this.store.snapshot()) {
			if (record.type !== 'shape') continue;
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
		const ids = new Set<string>();
		for (const shape of this.getShapes())
			if (!this.util(shape.kind).group && !this.isLocked(shape) && this.isInFocus(shape))
				ids.add(this.getSelectable(shape).id);
		this.select([...ids]);
	}

	/** The selected shapes that are not inside another selected shape, and not locked. */
	getSelectionRoots(): ShapeRecord[] {
		const selected = new Set(this.selection.get());
		return this.getSelectedShapes().filter((shape) => {
			if (this.isLocked(shape)) return false;
			for (let parent = this.getShape(shape.parentId); parent;) {
				if (selected.has(parent.id)) return false;
				parent = this.getShape(parent.parentId);
			}
			return true;
		});
	}

	/** The upright box around everything selected (page space), or undefined. */
	getSelectionBounds(): Box | undefined {
		return box.union(this.getSelectedShapes().map((shape) => this.getShapePageBounds(shape)));
	}

	/**
	 * The box the selection's handles sit on. `bounds` is in the page turned back by
	 * `rotation`: one turned shape keeps its own box, several shapes get an upright one.
	 */
	getSelectionFrame(): { rotation: number; bounds: Box } | undefined {
		const shapes = this.getSelectedShapes();
		if (shapes.length === 1) {
			const [shape] = shapes;
			const rotation = this.getShapePageRotation(shape);
			if (rotation !== 0) {
				const origin = vec.rotate(this.getShapePageOrigin(shape), -rotation);
				return { rotation, bounds: box.translate(this.util(shape.kind).bounds(shape), origin) };
			}
		}
		const bounds = this.getSelectionBounds();
		return bounds && { rotation: 0, bounds };
	}

	/**
	 * Whether the selection shows resize handles: nothing in it is locked, all of it resizes,
	 * and all of it is turned the same way as the box the handles sit on.
	 */
	canResizeSelection(): boolean {
		const shapes = this.getSelectedShapes();
		if (shapes.length === 0 || this.getShapeHandles()) return false;
		const rotation = shapes.length === 1 ? this.getShapePageRotation(shapes[0]) : 0;
		return (
			shapes.every((shape) => !this.isLocked(shape)) &&
			this.getLeaves(shapes).every(
				(leaf) =>
					this.util(leaf.kind).canResize(leaf) &&
					tidyAngle(this.getShapePageRotation(leaf) - rotation) === 0
			)
		);
	}

	/** Whether the selection shows the handle that turns it. */
	canRotateSelection(): boolean {
		return this.getSelectionRoots().length > 0 && !this.getShapeHandles();
	}

	/** Where the handle that turns the selection sits (page space): above its top edge. */
	getRotateHandle(): Vec | null {
		const frame = this.getSelectionFrame();
		if (!frame || !this.canRotateSelection()) return null;
		const { bounds, rotation } = frame;
		const above = ROTATE_HANDLE_DISTANCE / this.camera.get().z;
		return vec.rotate({ x: bounds.x + bounds.w / 2, y: bounds.y - above }, rotation);
	}

	isRotateHandleAt(screen: Vec): boolean {
		const handle = this.getRotateHandle();
		return !!handle && vec.dist(this.pageToScreen(handle), screen) <= HIT_MARGIN + 3;
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
		const origin = vec.rotate(this.getShapePageOrigin(shape), -rotation);
		const local = box.translate(target, { x: shape.x - origin.x, y: shape.y - origin.y });
		const result = this.util(shape.kind).resize(shape, local, flip);
		const moved = vec.rotate({ x: result.x - shape.x, y: result.y - shape.y }, shape.rotation ?? 0);
		return { id: shape.id, x: shape.x + moved.x, y: shape.y + moved.y, props: result.props };
	}

	/**
	 * The handles of the one selected shape, in page space, when its kind has its own (a line's
	 * two ends). Null otherwise.
	 */
	getShapeHandles(): { shape: ShapeRecord; handles: ShapeHandle[] } | null {
		const selection = this.selection.get();
		const shape = selection.length === 1 ? this.getShape(selection[0]) : undefined;
		if (!shape || this.isLocked(shape)) return null;
		const handles = this.util(shape.kind).handles(shape);
		if (handles.length === 0) return null;
		return {
			shape,
			handles: handles.map(({ id, x, y }) => ({ id, ...this.shapeToPage(shape, { x, y }) }))
		};
	}

	/** The id of the selected shape's own handle under `screen`, if any. */
	getShapeHandleAt(screen: Vec): string | null {
		// The last handle wins where two overlap: a line just begun is grabbed by its end.
		const handles = this.getShapeHandles()?.handles ?? [];
		for (let i = handles.length - 1; i >= 0; i--)
			if (vec.dist(this.pageToScreen(handles[i]), screen) <= HIT_MARGIN + 2) return handles[i].id;
		return null;
	}

	/** The resize handle under `screen`, if the selection has handles there. */
	getHandleAt(screen: Vec): Handle | null {
		const frame = this.getSelectionFrame();
		if (!frame || !this.canResizeSelection()) return null;
		const { bounds } = frame;
		const p = vec.rotate(this.screenToPage(screen), -frame.rotation);
		const reach = (HIT_MARGIN + 2) / this.camera.peek().z;
		const near = (value: number, target: number) => Math.abs(value - target) <= reach;
		const left = near(p.x, bounds.x);
		const right = near(p.x, bounds.x + bounds.w);
		const top = near(p.y, bounds.y);
		const bottom = near(p.y, bounds.y + bounds.h);
		if (top && left) return 'top_left';
		if (top && right) return 'top_right';
		if (bottom && right) return 'bottom_right';
		if (bottom && left) return 'bottom_left';
		const withinX = p.x > bounds.x && p.x < bounds.x + bounds.w;
		const withinY = p.y > bounds.y && p.y < bounds.y + bounds.h;
		if (top && withinX) return 'top';
		if (bottom && withinX) return 'bottom';
		if (left && withinY) return 'left';
		if (right && withinY) return 'right';
		return null;
	}

	deleteSelection() {
		const ids = this.getSelectedShapes()
			.filter((shape) => !this.isLocked(shape))
			.map((shape) => shape.id);
		if (ids.length === 0) return;
		this.history.mark();
		this.deleteShapes(ids);
	}

	/**
	 * The shapes, and all that is in them, as records that stand on their own: placed on the
	 * page, tied only to each other. This is what goes on the clipboard.
	 */
	getContent(ids: readonly string[] = this.selection.peek()): ShapeRecord[] {
		const picked = new Set(ids);
		const all = this.getShapes();
		// Shape ids come parent first, so one pass catches every descendant.
		for (const shape of all) if (picked.has(shape.parentId)) picked.add(shape.id);
		return all
			.filter((shape) => picked.has(shape.id))
			.map((shape) => {
				const retied = this.util(shape.kind).retie(shape, (id) => (picked.has(id) ? id : null));
				// A copy is never locked.
				const next = {
					...shape,
					...retied,
					locked: undefined,
					props: { ...shape.props, ...retied?.props }
				};
				if (picked.has(shape.parentId)) return next as ShapeRecord;
				// A top one is placed on the page itself, turned as it shows.
				const parent = this.getShape(shape.parentId);
				const at = parent ? this.shapeToPage(parent, next) : next;
				const rotation = this.getShapePageRotation(shape);
				return {
					...next,
					x: at.x,
					y: at.y,
					parentId: '',
					...(rotation ? { rotation } : {})
				} as ShapeRecord;
			});
	}

	/**
	 * Adds content (from `getContent`) to the page as new shapes and selects them. With `at`
	 * its middle lands on that page point; otherwise it lands `offset` down and right of where
	 * it came from.
	 */
	putContent(
		content: readonly ShapeRecord[],
		options: { at?: Vec; offset?: number } = {}
	): ShapeRecord[] {
		const shapes = content.filter((shape) => this.hasUtil(shape.kind));
		const ids = new Map(shapes.map((shape) => [shape.id, createId('shape')]));
		const roots = shapes.filter((shape) => !ids.has(shape.parentId));
		if (roots.length === 0) return [];
		let dx = options.offset ?? 16;
		let dy = dx;
		if (options.at) {
			const corners = roots.flatMap((root) =>
				box
					.corners(this.util(root.kind).bounds(root))
					.map((corner) => vec.add(vec.rotate(corner, root.rotation ?? 0), root))
			);
			const middle = box.center(box.around(corners));
			dx = options.at.x - middle.x;
			dy = options.at.y - middle.y;
		}
		const made = this.createShapes(
			shapes.map((shape) => {
				const root = !ids.has(shape.parentId);
				// Ties now point at the copies.
				const retied = this.util(shape.kind).retie(shape, (id) => ids.get(id) ?? null);
				return {
					id: ids.get(shape.id),
					kind: shape.kind,
					parentId: root ? undefined : ids.get(shape.parentId),
					index: root ? undefined : shape.index,
					x: (retied?.x ?? shape.x) + (root ? dx : 0),
					y: (retied?.y ?? shape.y) + (root ? dy : 0),
					rotation: shape.rotation,
					props: { ...shape.props, ...retied?.props },
					style: shape.style
				};
			})
		);
		this.select(roots.map((root) => ids.get(root.id)!));
		return made;
	}

	/** Copies the selection a little down and right (or `offset` away), and selects the copies. */
	duplicateSelection(offset = 16) {
		const roots = this.getSelectionRoots();
		if (roots.length === 0) return;
		this.history.mark();
		this.putContent(this.getContent(roots.map((shape) => shape.id)), { offset });
	}

	/** Puts the selection on the clipboard the editor keeps (`clipboard`), and returns it. */
	copy(): ShapeRecord[] {
		const roots = this.getSelectionRoots();
		if (roots.length > 0) this.clipboard = this.getContent(roots.map((shape) => shape.id));
		return roots.length > 0 ? this.clipboard : [];
	}

	cut(): ShapeRecord[] {
		const content = this.copy();
		this.deleteSelection();
		return content;
	}

	/** Pastes content (the editor's own clipboard by default), its middle at `at` if given. */
	paste(content: readonly ShapeRecord[] = this.clipboard, at?: Vec) {
		if (content.length === 0) return;
		this.history.mark();
		const made = this.putContent(content, at ? { at } : {});
		this.settle(made.map((shape) => shape.id));
		this.history.mark();
	}

	/**
	 * Pastes plain text as a shape, its middle at `at`: the first kind that says it is made
	 * from text (`ShapeUtil.fromText`) makes it. Nothing happens when no kind does.
	 */
	pasteText(text: string, at: Vec) {
		for (const [kind, util] of this.#utils) {
			const props = util.fromText(text);
			if (!props) continue;
			this.history.mark();
			const shape = this.createShape({ kind, x: at.x, y: at.y, props });
			const bounds = util.bounds(shape);
			this.updateShape(shape.id, { x: at.x - bounds.w / 2, y: at.y - bounds.h / 2 });
			this.select([shape.id]);
			this.setTool('select');
			this.settle([shape.id]);
			this.history.mark();
			return;
		}
	}

	/** The change that moves `shape` by `d`, a distance on the page. */
	#moved(shape: ShapeRecord, d: Vec): { id: string; x: number; y: number } {
		const parent = this.getShape(shape.parentId);
		const local = parent ? vec.rotate(d, -this.getShapePageRotation(parent)) : d;
		return { id: shape.id, x: shape.x + local.x, y: shape.y + local.y };
	}

	/** Moves the selection by a step (the arrow keys). */
	nudgeSelection(dx: number, dy: number) {
		const ids = this.getSelectionRoots().map((shape) => shape.id);
		if (ids.length === 0) return;
		this.history.mark();
		this.releaseTies(ids);
		this.updateShapes(ids.map((id) => this.#moved(this.getShape(id)!, { x: dx, y: dy })));
	}

	/** Lines the selected shapes up along one edge (or the middle) of the box around them. */
	alignSelection(edge: AlignEdge) {
		const shapes = this.getSelectionRoots();
		const bounds = box.union(shapes.map((shape) => this.getShapePageBounds(shape)));
		if (shapes.length < 2 || !bounds) return;
		this.history.mark();
		this.releaseTies(shapes.map((shape) => shape.id));
		this.updateShapes(
			shapes.map((shape) => {
				const b = this.getShapePageBounds(shape);
				const d = { x: 0, y: 0 };
				if (edge === 'left') d.x = bounds.x - b.x;
				else if (edge === 'center') d.x = bounds.x + bounds.w / 2 - (b.x + b.w / 2);
				else if (edge === 'right') d.x = bounds.x + bounds.w - (b.x + b.w);
				else if (edge === 'top') d.y = bounds.y - b.y;
				else if (edge === 'middle') d.y = bounds.y + bounds.h / 2 - (b.y + b.h / 2);
				else d.y = bounds.y + bounds.h - (b.y + b.h);
				return this.#moved(this.getShape(shape.id)!, d);
			})
		);
	}

	/** Spreads three or more selected shapes so the gaps between them are equal. */
	distributeSelection(axis: 'x' | 'y') {
		const size = axis === 'x' ? 'w' : 'h';
		const items = this.getSelectionRoots()
			.map((shape) => ({ shape, bounds: this.getShapePageBounds(shape) }))
			.sort((a, b) => a.bounds[axis] - b.bounds[axis]);
		if (items.length < 3) return;
		const first = items[0].bounds;
		const last = items[items.length - 1].bounds;
		const taken = items.reduce((sum, item) => sum + item.bounds[size], 0);
		const gap = (last[axis] + last[size] - first[axis] - taken) / (items.length - 1);
		this.history.mark();
		this.releaseTies(items.map((item) => item.shape.id));
		let at = first[axis];
		this.updateShapes(
			items.map(({ shape, bounds }) => {
				const d = { x: 0, y: 0 };
				d[axis] = at - bounds[axis];
				at += bounds[size] + gap;
				return this.#moved(this.getShape(shape.id)!, d);
			})
		);
	}

	/** Mirrors the selection left to right (`x`) or top to bottom (`y`) within its box. */
	flipSelection(axis: 'x' | 'y') {
		const roots = this.getSelectionRoots();
		const bounds = box.union(roots.map((shape) => this.getShapePageBounds(shape)));
		// Only what stands upright mirrors cleanly in an upright box.
		const leaves = this.getLeaves(roots).filter(
			(leaf) => this.getShapePageRotation(leaf) === 0 && this.util(leaf.kind).canResize(leaf)
		);
		if (!bounds || leaves.length === 0) return;
		this.history.mark();
		this.updateShapes(
			leaves.map((leaf) => {
				const b = this.getShapePageBounds(leaf);
				const target =
					axis === 'x'
						? { ...b, x: bounds.x * 2 + bounds.w - b.x - b.w }
						: { ...b, y: bounds.y * 2 + bounds.h - b.y - b.h };
				return this.getResizePatch(leaf, target, 0, { x: axis === 'x', y: axis === 'y' });
			})
		);
	}

	/** Locks the selection, or unlocks it when all of it is locked. A locked shape lets go. */
	toggleLock() {
		const shapes = this.getSelectedShapes();
		if (shapes.length === 0) return;
		const locked = !shapes.every((shape) => shape.locked);
		this.history.mark();
		this.updateShapes(shapes.map((shape) => ({ id: shape.id, locked })));
		if (locked) this.select([]);
	}

	/** The kind that groups, if a plugin brought one. */
	#groupKind(): string | undefined {
		for (const [kind, util] of this.#utils) if (util.group) return kind;
		return undefined;
	}

	/** Whether the selection can be made a group: two or more shapes with the same parent. */
	canGroupSelection(): boolean {
		const roots = this.getSelectionRoots();
		return (
			!!this.#groupKind() &&
			roots.length > 1 &&
			roots.every((shape) => shape.parentId === roots[0].parentId)
		);
	}

	/** Makes the selected shapes one group, in the place of the topmost of them. */
	groupSelection() {
		const kind = this.#groupKind();
		if (!kind || !this.canGroupSelection()) return;
		const picked = new Set(this.getSelectionRoots().map((shape) => shape.id));
		const shapes = this.getShapes().filter((shape) => picked.has(shape.id));
		const parentId = shapes[0].parentId;
		const at = { x: Math.min(...shapes.map((s) => s.x)), y: Math.min(...shapes.map((s) => s.y)) };
		this.history.mark();
		let groupId = '';
		this.store.transact(() => {
			groupId = this.createShape({
				kind,
				parentId,
				index: shapes[shapes.length - 1].index,
				x: at.x,
				y: at.y
			}).id;
			this.updateShapes(
				shapes.map((shape) => ({
					id: shape.id,
					parentId: groupId,
					x: shape.x - at.x,
					y: shape.y - at.y
				}))
			);
		});
		this.history.mark();
		this.select([groupId]);
	}

	/** Takes the selected groups apart; what was in them stays where it shows. */
	ungroupSelection() {
		const groups = this.getSelectedShapes().filter((shape) => this.util(shape.kind).group);
		if (groups.length === 0) return;
		const freed: string[] = [];
		this.history.mark();
		this.store.transact(() => {
			for (const group of groups) {
				const siblings = this.#siblings(group.parentId);
				const at = siblings.findIndex((shape) => shape.id === group.id);
				let below = siblings[at - 1]?.index;
				const above = siblings[at + 1]?.index;
				const turn = group.rotation ?? 0;
				this.updateShapes(
					this.getChildren(group.id).map((child) => {
						const place = vec.add(vec.rotate(child, turn), group);
						below = indexBetween(below, above);
						freed.push(child.id);
						return {
							id: child.id,
							parentId: group.parentId,
							index: below,
							x: place.x,
							y: place.y,
							rotation: tidyAngle((child.rotation ?? 0) + turn)
						};
					})
				);
				this.store.remove([group.id]);
			}
		});
		this.history.mark();
		this.select(freed);
	}

	/**
	 * After shapes were made or moved: each whose middle now lies on a frame becomes that
	 * frame's, each that left its frame becomes the page's. It stays where it shows.
	 */
	settle(ids: readonly string[] = this.selection.peek()) {
		const frames = this.getShapes().filter((shape) => this.util(shape.kind).frame);
		if (frames.length === 0) return;
		const tops = new Map<string, string | undefined>();
		const patches: ({ id: string } & ShapePatch)[] = [];
		for (const id of ids) {
			const shape = this.getShape(id);
			if (!shape || this.util(shape.kind).frame) continue;
			// Only what sits on the page or in a frame moves between them; a group keeps its own.
			const parent = this.getShape(shape.parentId);
			if (parent && !this.util(parent.kind).frame) continue;
			const middle = box.center(this.getShapePageBounds(shape));
			let home: ShapeRecord | undefined;
			for (let i = frames.length - 1; i >= 0 && !home; i--) {
				const frame = frames[i];
				if (box.contains(this.util(frame.kind).bounds(frame), this.pageToShape(frame, middle)))
					home = frame;
			}
			const homeId = home?.id ?? this.pageId.peek();
			if (homeId === shape.parentId) continue;
			const origin = this.getShapePageOrigin(shape);
			const place = home ? this.pageToShape(home, origin) : origin;
			if (!tops.has(homeId)) tops.set(homeId, this.#topIndex(homeId));
			const index = indexBetween(tops.get(homeId));
			tops.set(homeId, index);
			patches.push({
				id,
				parentId: homeId,
				index,
				x: place.x,
				y: place.y,
				rotation: tidyAngle(
					this.getShapePageRotation(shape) - (home ? this.getShapePageRotation(home) : 0)
				)
			});
		}
		if (patches.length > 0) this.updateShapes(patches);
	}

	/** The places other shapes offer to snap to: their edges and middles, on each axis. */
	#snapStops(exclude: ReadonlySet<string>): { xs: [number, Box][]; ys: [number, Box][] } {
		const { w, h } = this.viewport.peek();
		const a = this.screenToPage({ x: 0, y: 0 });
		const b = this.screenToPage({ x: w, y: h });
		const view = box.fromPoints(a, b);
		const xs: [number, Box][] = [];
		const ys: [number, Box][] = [];
		const skipped = new Set(exclude);
		for (const shape of this.getShapes()) {
			// What is inside a moving shape moves too.
			if (skipped.has(shape.id) || skipped.has(shape.parentId)) {
				skipped.add(shape.id);
				continue;
			}
			const util = this.util(shape.kind);
			if (util.group || util.ties(shape).length > 0) continue;
			const bounds = this.getShapePageBounds(shape);
			if (!box.intersects(view, bounds)) continue;
			for (const x of [bounds.x, bounds.x + bounds.w / 2, bounds.x + bounds.w])
				xs.push([x, bounds]);
			for (const y of [bounds.y, bounds.y + bounds.h / 2, bounds.y + bounds.h])
				ys.push([y, bounds]);
		}
		return { xs, ys };
	}

	/**
	 * How far to shift `moving` (a box on the page) so that one of its edges or its middle
	 * meets another shape's. Shows the guides for it in `snapLines`.
	 */
	snapBox(moving: Box, exclude: ReadonlySet<string>): Vec {
		const reach = SNAP_DISTANCE / this.camera.peek().z;
		const stops = this.#snapStops(exclude);
		const nearest = (values: number[], candidates: [number, Box][]) => {
			let best: { d: number; at: number; other: Box } | undefined;
			for (const value of values)
				for (const [at, other] of candidates) {
					const d = at - value;
					if (Math.abs(d) <= reach && (!best || Math.abs(d) < Math.abs(best.d)))
						best = { d, at, other };
				}
			return best;
		};
		const x = nearest([moving.x, moving.x + moving.w / 2, moving.x + moving.w], stops.xs);
		const y = nearest([moving.y, moving.y + moving.h / 2, moving.y + moving.h], stops.ys);
		const moved = box.translate(moving, { x: x?.d ?? 0, y: y?.d ?? 0 });
		const lines: SnapLine[] = [];
		if (x) {
			const span = box.union([moved, x.other])!;
			lines.push({ from: { x: x.at, y: span.y }, to: { x: x.at, y: span.y + span.h } });
		}
		if (y) {
			const span = box.union([moved, y.other])!;
			lines.push({ from: { x: span.x, y: y.at }, to: { x: span.x + span.w, y: y.at } });
		}
		this.snapLines.set(lines);
		return { x: x?.d ?? 0, y: y?.d ?? 0 };
	}

	/** `point` moved onto another shape's edge or middle where one is near, on the given axes. */
	snapPoint(point: Vec, exclude: ReadonlySet<string>, axes: { x: boolean; y: boolean }): Vec {
		const d = this.snapBox({ x: point.x, y: point.y, w: 0, h: 0 }, exclude);
		const lines = this.snapLines.peek();
		// A guide for an axis the point does not move on would be a lie.
		this.snapLines.set(lines.filter((line) => (line.from.x === line.to.x ? axes.x : axes.y)));
		return { x: point.x + (axes.x ? d.x : 0), y: point.y + (axes.y ? d.y : 0) };
	}

	/** Sets a style on the selection (on what is in a selected group) and for the next shape. */
	setStyle(patch: Partial<ShapeStyle>) {
		this.style.set({ ...this.style.peek(), ...patch });
		const leaves = this.getLeaves(this.getSelectedShapes()).filter((leaf) => !this.isLocked(leaf));
		if (leaves.length === 0) return;
		this.history.mark();
		this.updateShapes(leaves.map((leaf) => ({ id: leaf.id, style: patch })));
	}

	// ── Camera ──────────────────────────────────────────────────────────────────────────────

	screenToPage(point: Vec): Vec {
		const { x, y, z } = this.camera.peek();
		return { x: (point.x - x) / z, y: (point.y - y) / z };
	}

	pageToScreen(point: Vec): Vec {
		const { x, y, z } = this.camera.peek();
		return { x: point.x * z + x, y: point.y * z + y };
	}

	/** Moves the view by screen pixels. */
	pan(dx: number, dy: number) {
		const { x, y, z } = this.camera.peek();
		this.camera.set({ x: x + dx, y: y + dy, z });
	}

	/** Zooms to `zoom`, keeping the page point under `anchor` (screen; the centre by default) still. */
	zoomTo(zoom: number, anchor?: Vec) {
		const { x, y, z } = this.camera.peek();
		const { w, h } = this.viewport.peek();
		const at = anchor ?? { x: w / 2, y: h / 2 };
		const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
		this.camera.set({
			x: at.x - ((at.x - x) * next) / z,
			y: at.y - ((at.y - y) * next) / z,
			z: next
		});
	}

	zoomIn() {
		const { z } = this.camera.peek();
		this.zoomTo(ZOOM_STEPS.find((step) => step > z * 1.001) ?? MAX_ZOOM);
	}

	zoomOut() {
		const { z } = this.camera.peek();
		this.zoomTo(ZOOM_STEPS.findLast((step) => step < z * 0.999) ?? MIN_ZOOM);
	}

	resetZoom() {
		this.zoomTo(1);
	}

	/** Fits every shape on the page into view (never closer than 100%). */
	zoomToFit() {
		const bounds = box.union(this.getShapes().map((shape) => this.getShapePageBounds(shape)));
		const { w, h } = this.viewport.peek();
		if (!bounds || w === 0 || h === 0) return;
		const padding = 64;
		const z = Math.min(
			1,
			Math.max(MIN_ZOOM, Math.min((w - padding * 2) / bounds.w, (h - padding * 2) / bounds.h))
		);
		const centre = box.center(bounds);
		this.camera.set({ x: w / 2 - centre.x * z, y: h / 2 - centre.y * z, z });
	}

	/** Brings the selection into view, as large as fits (never past 100%). */
	zoomToSelection() {
		const bounds = this.getSelectionBounds();
		const { w, h } = this.viewport.peek();
		if (!bounds || w === 0 || h === 0) return;
		const padding = 64;
		const z = Math.min(
			1,
			Math.max(
				MIN_ZOOM,
				Math.min(
					(w - padding * 2) / Math.max(1, bounds.w),
					(h - padding * 2) / Math.max(1, bounds.h)
				)
			)
		);
		const centre = box.center(bounds);
		this.camera.set({ x: w / 2 - centre.x * z, y: h / 2 - centre.y * z, z });
	}

	// ── History ─────────────────────────────────────────────────────────────────────────────

	undo() {
		this.stopEditing();
		this.dispatchCancelIfBusy();
		this.history.undo();
	}

	redo() {
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
