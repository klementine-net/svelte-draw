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
import type { ShapeUtil, ShapeUtilConstructor } from './shape-util.ts';
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
	props?: Record<string, unknown>;
	style?: Partial<ShapeStyle>;
}

export type ShapePatch = Partial<Pick<ShapeRecord, 'x' | 'y' | 'index' | 'parentId'>> & {
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

		if (event.type === 'pointer' || event.type === 'double_click') {
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
			const index = indexBetween(tops.get(parentId));
			tops.set(parentId, index);
			return {
				id: shape.id ?? createId('shape'),
				type: 'shape',
				kind: shape.kind,
				parentId,
				index,
				x: shape.x,
				y: shape.y,
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
		for (const shape of this.getShapes()) if (doomed.has(shape.parentId)) doomed.add(shape.id);
		this.store.remove([...doomed]);
	}

	/** Where the shape's origin is on the page (its `x`/`y` plus every parent's). */
	getShapePageOrigin(shape: ShapeRecord): Vec {
		let x = shape.x;
		let y = shape.y;
		let parent = this.getShape(shape.parentId);
		while (parent) {
			x += parent.x;
			y += parent.y;
			parent = this.getShape(parent.parentId);
		}
		return { x, y };
	}

	getShapePageBounds(shape: ShapeRecord): Box {
		return box.translate(this.util(shape.kind).bounds(shape), this.getShapePageOrigin(shape));
	}

	/** The topmost shape touching `point` (page space), or undefined. */
	getShapeAtPoint(point: Vec): ShapeRecord | undefined {
		const margin = HIT_MARGIN / this.camera.peek().z;
		const shapes = this.getShapes();
		for (let i = shapes.length - 1; i >= 0; i--) {
			const shape = shapes[i];
			const local = vec.sub(point, this.getShapePageOrigin(shape));
			if (this.util(shape.kind).hitTest(shape, local, margin)) return shape;
		}
		return undefined;
	}

	/** Every shape whose bounds touch `area` (page space). */
	getShapesInBox(area: Box): ShapeRecord[] {
		return this.getShapes().filter((shape) => box.intersects(area, this.getShapePageBounds(shape)));
	}

	bringToFront(ids: readonly string[] = this.selection.peek()) {
		this.#restack(ids, 'front');
	}

	sendToBack(ids: readonly string[] = this.selection.peek()) {
		this.#restack(ids, 'back');
	}

	#restack(ids: readonly string[], where: 'front' | 'back') {
		const moving = this.getShapes().filter((shape) => ids.includes(shape.id));
		if (where === 'back') moving.reverse();
		this.history.mark();
		this.store.transact(() => {
			for (const shape of moving) {
				const siblings = this.#siblings(shape.parentId).filter((s) => s.id !== shape.id);
				if (siblings.length === 0) continue;
				const index =
					where === 'front'
						? indexBetween(siblings[siblings.length - 1].index)
						: indexBetween(undefined, siblings[0].index);
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

	selectAll() {
		this.select(this.getShapeIds());
	}

	/** The box around everything selected (page space), or undefined. */
	getSelectionBounds(): Box | undefined {
		return box.union(this.getSelectedShapes().map((shape) => this.getShapePageBounds(shape)));
	}

	/** Whether the selection shows resize handles: something is selected and all of it resizes. */
	canResizeSelection(): boolean {
		const shapes = this.getSelectedShapes();
		return shapes.length > 0 && shapes.every((shape) => this.util(shape.kind).canResize(shape));
	}

	/** The resize handle under `screen`, if the selection has handles there. */
	getHandleAt(screen: Vec): Handle | null {
		const bounds = this.getSelectionBounds();
		if (!bounds || !this.canResizeSelection()) return null;
		const a = this.pageToScreen({ x: bounds.x, y: bounds.y });
		const b = this.pageToScreen({ x: bounds.x + bounds.w, y: bounds.y + bounds.h });
		const near = (value: number, target: number) => Math.abs(value - target) <= HIT_MARGIN + 2;
		const left = near(screen.x, a.x);
		const right = near(screen.x, b.x);
		const top = near(screen.y, a.y);
		const bottom = near(screen.y, b.y);
		if (top && left) return 'top_left';
		if (top && right) return 'top_right';
		if (bottom && right) return 'bottom_right';
		if (bottom && left) return 'bottom_left';
		const withinX = screen.x > a.x && screen.x < b.x;
		const withinY = screen.y > a.y && screen.y < b.y;
		if (top && withinX) return 'top';
		if (bottom && withinX) return 'bottom';
		if (left && withinY) return 'left';
		if (right && withinY) return 'right';
		return null;
	}

	deleteSelection() {
		const ids = this.selection.peek();
		if (ids.length === 0) return;
		this.history.mark();
		this.deleteShapes(ids);
	}

	/** Copies the selection a little down and right, and selects the copies. */
	duplicateSelection() {
		const shapes = this.getSelectedShapes();
		if (shapes.length === 0) return;
		this.history.mark();
		const copies = this.createShapes(
			shapes.map((shape) => ({
				kind: shape.kind,
				parentId: shape.parentId,
				x: shape.x + 16,
				y: shape.y + 16,
				props: shape.props,
				style: shape.style
			}))
		);
		this.select(copies.map((copy) => copy.id));
	}

	/** Moves the selection by a step (the arrow keys). */
	nudgeSelection(dx: number, dy: number) {
		const shapes = this.getSelectedShapes();
		if (shapes.length === 0) return;
		this.history.mark();
		this.updateShapes(shapes.map((shape) => ({ id: shape.id, x: shape.x + dx, y: shape.y + dy })));
	}

	/** Sets the style of the selection and of the next shape. */
	setStyle(patch: Partial<ShapeStyle>) {
		this.style.set({ ...this.style.peek(), ...patch });
		const ids = this.selection.peek();
		if (ids.length === 0) return;
		this.history.mark();
		this.updateShapes(ids.map((id) => ({ id, style: patch })));
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

	// ── History ─────────────────────────────────────────────────────────────────────────────

	undo() {
		this.dispatchCancelIfBusy();
		this.history.undo();
	}

	redo() {
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
