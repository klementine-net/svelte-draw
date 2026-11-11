/*
 * The select tool: pick, move, resize, turn, marquee. Each interaction is its own state, so
 * „what does a pointer move mean right now“ is answered by which state is active, never by
 * flags.
 *
 *   idle ─ press a shape's own handle ──→ dragging_handle (a line's end)
 *        ─ press the turn handle ───────→ rotating
 *        ─ press a resize handle ───────→ resizing
 *        ─ press a shape or selection ──→ pointing_shape ─ drag → translating
 *        ─ press the canvas ────────────→ pointing_canvas ─ drag → brushing
 *        ─ double click, or Enter ──────→ editing (shapes whose util says `canEdit`)
 */

import { box, vec, type Box, type Vec } from '../core/geometry.ts';
import type { ShapeRecord } from '../core/records.ts';
import type { Handle } from '../core/editor.ts';
import { StateNode } from '../core/state-node.ts';
import type { KeyInfo, PointerInfo } from '../core/events.ts';

/** The cursor for each handle of an upright box, as a compass angle in steps of 45°. */
const HANDLE_ANGLE: Record<Handle, number> = {
	right: 0,
	bottom_right: 1,
	bottom: 2,
	bottom_left: 3,
	left: 4,
	top_left: 5,
	top: 6,
	top_right: 7
};
const RESIZE_CURSORS = ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize'];

/** Whether all of `inner` lies in `outer`. */
const encloses = (outer: Box, inner: Box) =>
	inner.x >= outer.x &&
	inner.y >= outer.y &&
	inner.x + inner.w <= outer.x + outer.w &&
	inner.y + inner.h <= outer.y + outer.h;

/** The resize cursor for a handle on a box turned by `rotation`. */
function handleCursor(handle: Handle, rotation: number): string {
	const steps = HANDLE_ANGLE[handle] + Math.round(rotation / (Math.PI / 4));
	return RESIZE_CURSORS[((steps % 4) + 4) % 4];
}

class Idle extends StateNode {
	static override id = 'idle';

	override onEnter() {
		this.editor.cursor.set('default');
	}

	override onExit() {
		this.editor.hovered.set(null);
	}

	/** What a press at the pointer would pick: a shape, or the group it is in. */
	#target(): ShapeRecord | undefined {
		const { editor } = this;
		const leaf = editor.getShapeAtPoint(editor.inputs.page);
		return leaf && editor.getSelectable(leaf);
	}

	override onPointerMove() {
		const { editor } = this;
		const { screen } = editor.inputs;
		if (editor.getShapeHandleAt(screen) || editor.isRotateHandleAt(screen)) {
			editor.cursor.set('grab');
			editor.hovered.set(null);
			return;
		}
		const handle = editor.getHandleAt(screen);
		const rotation = editor.getSelectionFrame()?.rotation ?? 0;
		editor.cursor.set(handle ? handleCursor(handle, rotation) : 'default');
		editor.hovered.set(handle ? null : (this.#target()?.id ?? null));
	}

	override onPointerDown(event: PointerInfo) {
		const { editor } = this;
		if (event.button !== 0) return;
		const { screen, page } = editor.inputs;

		const own = editor.getShapeHandleAt(screen);
		if (own) return this.parent!.transition('dragging_handle', { handle: own });
		if (editor.isRotateHandleAt(screen)) return this.parent!.transition('rotating');
		const handle = editor.getHandleAt(screen);
		if (handle) return this.parent!.transition('resizing', { handle });

		// A press outside the group that was stepped into steps back out of it.
		const leaf = editor.getShapeAtPoint(page);
		if (!leaf || !editor.isInFocus(leaf)) editor.focusedGroup.set(null);
		const hit = leaf && editor.getSelectable(leaf);
		const selection = editor.selection.peek();
		if (hit) {
			if (event.shift) {
				// Shift adds to the selection, or takes the shape out of it.
				editor.select(
					selection.includes(hit.id)
						? selection.filter((id) => id !== hit.id)
						: [...selection, hit.id]
				);
				return this.parent!.transition('pointing_shape', { collapseTo: null });
			}
			const wasSelected = selection.includes(hit.id);
			if (!wasSelected) editor.select([hit.id]);
			// A click on one of several selected shapes narrows to it, but only on release:
			// a drag must still move them all.
			return this.parent!.transition('pointing_shape', { collapseTo: wasSelected ? hit.id : null });
		}

		// Inside the selection's box (a hollow shape's middle): still a grab of the selection.
		const bounds = editor.getSelectionBounds();
		if (bounds && box.contains(bounds, page) && editor.getSelectionRoots().length > 0)
			return this.parent!.transition('pointing_shape', { collapseTo: null, clearOnClick: true });

		this.parent!.transition('pointing_canvas');
	}

	/** A group is stepped into; a shape that holds text is typed into. */
	override onDoubleClick() {
		const { editor } = this;
		const { page } = editor.inputs;
		// Also in the empty middle of the one selected shape: a hollow box is written in there.
		const [only, ...more] = editor.getSelectedShapes();
		const inside =
			only && more.length === 0 && !editor.isLocked(only)
				? box.contains(editor.util(only.kind).bounds(only), editor.pageToShape(only, page))
				: false;
		const leaf = editor.getShapeAtPoint(page) ?? (inside ? only : undefined);
		if (!leaf) return;
		const hit = editor.getSelectable(leaf);
		if (editor.util(hit.kind).group) {
			editor.focusedGroup.set(hit.id);
			editor.select([editor.getSelectable(leaf).id]);
			return;
		}
		editor.startEditing(hit.id);
	}

	override onKeyDown(event: KeyInfo) {
		const { editor } = this;
		const step = event.shift ? 10 : 1;
		switch (event.key) {
			case 'Enter': {
				const selection = editor.selection.peek();
				if (selection.length === 1) editor.startEditing(selection[0]);
				return;
			}
			case 'Delete':
			case 'Backspace':
				return editor.deleteSelection();
			case 'ArrowLeft':
				return editor.nudgeSelection(-step, 0);
			case 'ArrowRight':
				return editor.nudgeSelection(step, 0);
			case 'ArrowUp':
				return editor.nudgeSelection(0, -step);
			case 'ArrowDown':
				return editor.nudgeSelection(0, step);
			case 'a':
				if (event.meta) editor.selectAll();
				return;
			case 'd':
				if (event.meta) editor.duplicateSelection();
				return;
			case 'g':
			case 'G':
				if (!event.meta) return;
				return event.shift ? editor.ungroupSelection() : editor.groupSelection();
			case ']':
				return event.alt ? editor.bringForward() : editor.bringToFront();
			case '[':
				return event.alt ? editor.sendBackward() : editor.sendToBack();
		}
	}

	/** Escape steps out of a group first, then lets go of the selection. */
	override onCancel() {
		const { editor } = this;
		const focus = editor.focusedGroup.peek();
		editor.focusedGroup.set(null);
		editor.select(focus ? [focus] : []);
	}
}

interface PointingShapeInfo {
	collapseTo: string | null;
	clearOnClick?: boolean;
}

class PointingShape extends StateNode {
	static override id = 'pointing_shape';
	#info: PointingShapeInfo = { collapseTo: null };

	override onEnter(info: unknown) {
		this.#info = info as PointingShapeInfo;
	}

	override onPointerMove() {
		if (this.editor.inputs.isDragging && this.editor.getSelectionRoots().length > 0)
			this.parent!.transition('translating');
	}

	override onPointerUp() {
		if (this.#info.collapseTo) this.editor.select([this.#info.collapseTo]);
		else if (this.#info.clearOnClick) this.editor.select([]);
		this.parent!.transition('idle');
	}

	override onCancel() {
		this.parent!.transition('idle');
	}
}

class PointingCanvas extends StateNode {
	static override id = 'pointing_canvas';

	override onPointerMove() {
		if (this.editor.inputs.isDragging) this.parent!.transition('brushing');
	}

	override onPointerUp(event: PointerInfo) {
		if (!event.shift) this.editor.select([]);
		this.parent!.transition('idle');
	}

	override onCancel() {
		this.parent!.transition('idle');
	}
}

class Translating extends StateNode {
	static override id = 'translating';
	/** Each moving shape as it was, and how far its parent is turned on the page. */
	#start: { id: string; x: number; y: number; turn: number }[] = [];
	#bounds: Box = { x: 0, y: 0, w: 0, h: 0 };
	#moving = new Set<string>();

	override onEnter() {
		const { editor } = this;
		editor.history.mark();
		editor.cursor.set('move');
		// With Alt held, a copy is what moves; the shapes themselves stay.
		if (editor.inputs.alt) editor.duplicateSelection(0);
		const roots = editor.getSelectionRoots();
		// An attached arrow that is moved without its shape lets go of it.
		editor.releaseTies(roots.map((shape) => shape.id));
		this.#start = roots.map(({ id }) => {
			const shape = editor.getShape(id)!;
			const parent = editor.getShape(shape.parentId);
			return { id, x: shape.x, y: shape.y, turn: parent ? editor.getShapePageRotation(parent) : 0 };
		});
		this.#moving = new Set(this.#start.map(({ id }) => id));
		this.#bounds = box.union(
			this.#start.map(({ id }) => editor.getShapePageBounds(editor.getShape(id)!))
		) ?? { x: 0, y: 0, w: 0, h: 0 };
		this.#move();
	}

	override onPointerMove() {
		this.#move();
	}

	override onKeyDown() {
		this.#move();
	}

	override onKeyUp() {
		this.#move();
	}

	#move() {
		const { editor } = this;
		const { inputs } = editor;
		let d = vec.sub(inputs.page, inputs.originPage);
		// Shift keeps the move on one axis.
		if (inputs.shift) d = Math.abs(d.x) > Math.abs(d.y) ? { x: d.x, y: 0 } : { x: 0, y: d.y };
		// Edges and middles catch on other shapes'; Ctrl or Command lets them slide past.
		if (inputs.meta) editor.snapLines.set([]);
		else d = vec.add(d, editor.snapBox(box.translate(this.#bounds, d), this.#moving));
		editor.updateShapes(
			this.#start.map(({ id, x, y, turn }) => {
				const local = vec.rotate(d, -turn);
				return { id, x: x + local.x, y: y + local.y };
			})
		);
	}

	override onExit() {
		this.editor.snapLines.set([]);
	}

	override onPointerUp() {
		this.editor.settle([...this.#moving]);
		this.editor.history.mark();
		this.parent!.transition('idle');
	}

	override onCancel() {
		this.editor.history.bail();
		this.parent!.transition('idle');
	}
}

export interface ResizingInfo {
	handle: Handle;
	/** True when the shape was just made by a tool: the same undo step as its creation. */
	creating?: boolean;
	/** True when the shape is typed into as soon as it has its size. */
	edit?: boolean;
}

class Resizing extends StateNode {
	static override id = 'resizing';
	#handle: Handle = 'bottom_right';
	#edit = false;
	/** How far the box the handles sit on is turned, and the box itself in that turned space. */
	#rotation = 0;
	#bounds: Box = { x: 0, y: 0, w: 0, h: 0 };
	#start: { shape: ShapeRecord; bounds: Box }[] = [];
	#resized = new Set<string>();

	override onEnter(info: unknown) {
		const { editor } = this;
		const { handle, creating, edit } = info as ResizingInfo;
		if (!creating) editor.history.mark();
		this.#handle = handle;
		this.#edit = !!edit;
		const frame = editor.getSelectionFrame();
		this.#rotation = frame?.rotation ?? 0;
		this.#bounds = frame?.bounds ?? { x: 0, y: 0, w: 0, h: 0 };
		// What is in a group is what resizes. Every one is turned like the box, so its own box
		// is upright in the box's space.
		this.#start = editor.getLeaves(editor.getSelectedShapes()).map((shape) => ({
			shape,
			bounds: box.translate(
				editor.util(shape.kind).bounds(shape),
				vec.rotate(editor.getShapePageOrigin(shape), -this.#rotation)
			)
		}));
		this.#resized = new Set(editor.selection.peek());
		editor.cursor.set(handleCursor(handle, this.#rotation));
		// A shape just made is dragged out from its first moment.
		if (creating) this.#resize();
	}

	override onPointerMove() {
		this.#resize();
	}

	override onKeyDown() {
		this.#resize();
	}

	override onKeyUp() {
		this.#resize();
	}

	#resize() {
		const { editor } = this;
		const b = this.#bounds;
		const handle = this.#handle;
		const movesLeft = handle.includes('left');
		const movesRight = handle.includes('right');
		const movesTop = handle.includes('top');
		const movesBottom = handle.includes('bottom');
		const isCorner = (movesLeft || movesRight) && (movesTop || movesBottom);
		const keepsShape = editor.inputs.shift && isCorner && b.w > 0 && b.h > 0;

		let p = vec.rotate(editor.inputs.page, -this.#rotation);
		// The dragged edges catch on other shapes' (in an upright box, and not while Shift
		// holds the proportions or Ctrl or Command lets them slide past).
		if (this.#rotation === 0 && !keepsShape && !editor.inputs.meta)
			p = editor.snapPoint(p, this.#resized, {
				x: movesLeft || movesRight,
				y: movesTop || movesBottom
			});
		else editor.snapLines.set([]);

		// The dragged edges follow the pointer; the others stay.
		let left = b.x;
		let right = b.x + b.w;
		let top = b.y;
		let bottom = b.y + b.h;
		if (movesLeft) left = p.x;
		if (movesRight) right = p.x;
		if (movesTop) top = p.y;
		if (movesBottom) bottom = p.y;

		// Shift on a corner keeps the proportions.
		if (keepsShape) {
			const ratio = b.w / b.h;
			let w = right - left;
			let h = bottom - top;
			if (Math.abs(w) / ratio > Math.abs(h)) h = (Math.sign(h) || 1) * (Math.abs(w) / ratio);
			else w = (Math.sign(w) || 1) * Math.abs(h) * ratio;
			if (movesLeft) left = right - w;
			else right = left + w;
			if (movesTop) top = bottom - h;
			else bottom = top + h;
		}

		const scaleX = b.w > 0 ? (right - left) / b.w : 1;
		const scaleY = b.h > 0 ? (bottom - top) / b.h : 1;
		const flip = { x: scaleX < 0, y: scaleY < 0 };

		editor.updateShapes(
			this.#start.map(({ shape, bounds }) => {
				const target = box.fromPoints(
					{ x: left + (bounds.x - b.x) * scaleX, y: top + (bounds.y - b.y) * scaleY },
					{
						x: left + (bounds.x + bounds.w - b.x) * scaleX,
						y: top + (bounds.y + bounds.h - b.y) * scaleY
					}
				);
				return editor.getResizePatch(shape, target, this.#rotation, flip);
			})
		);
	}

	override onExit() {
		this.editor.snapLines.set([]);
	}

	override onPointerUp() {
		const { editor } = this;
		editor.settle([...this.#resized]);
		editor.history.mark();
		const selection = editor.selection.peek();
		if (this.#edit && selection.length === 1) return editor.startEditing(selection[0]);
		this.parent!.transition('idle');
	}

	override onCancel() {
		this.editor.history.bail();
		this.parent!.transition('idle');
	}
}

/** The selection turns around its middle, following the pointer. Shift: steps of 15 degrees. */
class Rotating extends StateNode {
	static override id = 'rotating';
	#pivot: Vec = { x: 0, y: 0 };
	#from = 0;
	/** The turn the selection's box had when the drag began. */
	#turned = 0;
	#start: { shape: ShapeRecord; origin: Vec }[] = [];

	override onEnter() {
		const { editor } = this;
		editor.history.mark();
		editor.cursor.set('grabbing');
		const frame = editor.getSelectionFrame();
		if (!frame) return void this.parent!.transition('idle');
		this.#turned = frame.rotation;
		this.#pivot = vec.rotate(box.center(frame.bounds), frame.rotation);
		this.#from = this.#angle();
		const roots = editor.getSelectionRoots();
		editor.releaseTies(roots.map((shape) => shape.id));
		this.#start = roots.map(({ id }) => {
			const shape = editor.getShape(id)!;
			return { shape, origin: editor.getShapePageOrigin(shape) };
		});
	}

	#angle(): number {
		const { page } = this.editor.inputs;
		return Math.atan2(page.y - this.#pivot.y, page.x - this.#pivot.x);
	}

	override onPointerMove() {
		this.#turn();
	}

	override onKeyDown() {
		this.#turn();
	}

	override onKeyUp() {
		this.#turn();
	}

	#turn() {
		const { editor } = this;
		let angle = this.#angle() - this.#from;
		if (editor.inputs.shift) {
			const step = Math.PI / 12;
			angle = Math.round((this.#turned + angle) / step) * step - this.#turned;
		}
		editor.updateShapes(
			this.#start.map(({ shape, origin }) => {
				const own = editor.util(shape.kind).rotate(shape, angle, this.#pivot);
				if (own) return { id: shape.id, ...own };
				const place = editor.pageToParent(
					shape,
					vec.add(this.#pivot, vec.rotate(vec.sub(origin, this.#pivot), angle))
				);
				return { id: shape.id, x: place.x, y: place.y, rotation: (shape.rotation ?? 0) + angle };
			})
		);
	}

	override onPointerUp() {
		const { editor } = this;
		editor.settle(this.#start.map(({ shape }) => shape.id));
		editor.history.mark();
		this.parent!.transition('idle');
	}

	override onCancel() {
		this.editor.history.bail();
		this.parent!.transition('idle');
	}
}

export interface DraggingHandleInfo {
	/** The id of the shape's handle, as its util names it. */
	handle: string;
	/** True when the shape was just made by a tool: the same undo step as its creation. */
	creating?: boolean;
}

/** One of the selected shape's own handles follows the pointer; what that means is the util's. */
class DraggingHandle extends StateNode {
	static override id = 'dragging_handle';
	#shape = '';
	#handle = '';

	override onEnter(info: unknown) {
		const { editor } = this;
		const { handle, creating } = info as DraggingHandleInfo;
		if (!creating) editor.history.mark();
		this.#shape = editor.selection.peek()[0];
		this.#handle = handle;
		editor.cursor.set('grabbing');
		if (creating) this.#drag();
	}

	override onPointerMove() {
		this.#drag();
	}

	override onKeyDown() {
		this.#drag();
	}

	override onKeyUp() {
		this.#drag();
	}

	#drag() {
		const { editor } = this;
		const shape = editor.getShape(this.#shape);
		if (!shape) return;
		const patch = editor.util(shape.kind).dragHandle(shape, this.#handle, editor.inputs.page);
		if (patch) editor.updateShape(shape.id, patch);
	}

	override onExit() {
		this.editor.hovered.set(null);
	}

	override onPointerUp() {
		this.editor.settle([this.#shape]);
		this.editor.history.mark();
		this.parent!.transition('idle');
	}

	override onCancel() {
		this.editor.history.bail();
		this.parent!.transition('idle');
	}
}

export interface EditingInfo {
	id: string;
	/** True when the shape was just made: making it and typing into it are one undo step. */
	creating?: boolean;
}

/**
 * A shape's content is being typed into. The typing itself happens in the shape's view; this
 * state only holds the canvas still meanwhile and makes the whole edit one undo step.
 */
class Editing extends StateNode {
	static override id = 'editing';
	#creating = false;

	override onEnter(info: unknown) {
		const { editor } = this;
		const { id, creating } = info as EditingInfo;
		this.#creating = !!creating;
		if (!creating) editor.history.mark();
		editor.editing.set(id);
		editor.cursor.set('default');
	}

	override onExit() {
		const { editor } = this;
		const id = editor.editing.peek();
		editor.editing.set(null);
		const shape = id ? editor.getShape(id) : undefined;
		if (shape) editor.util(shape.kind).onEditEnd(shape);
		// A new shape that ended with nothing in it leaves no trace.
		if (this.#creating && id && !editor.getShape(id)) return editor.history.bail();
		if (id && this.#creating) editor.settle([id]);
		editor.history.mark();
	}

	/** A press outside the text ends the edit, and then counts as the press it is. */
	override onPointerDown(event: PointerInfo) {
		this.parent!.transition('idle');
		this.parent!.current.peek()?.handleEvent(event);
	}

	override onCancel() {
		this.parent!.transition('idle');
	}
}

class Brushing extends StateNode {
	static override id = 'brushing';
	#initial: readonly string[] = [];

	override onEnter() {
		this.#initial = this.editor.inputs.shift ? this.editor.selection.peek() : [];
		this.editor.cursor.set('crosshair');
		this.#brush();
	}

	override onPointerMove() {
		this.#brush();
	}

	#brush() {
		const { editor } = this;
		const area = box.fromPoints(editor.inputs.originPage, editor.inputs.page);
		editor.brush.set(area);
		// What is touched picks its group, as a click on it would.
		const touched = new Set<string>();
		for (const shape of editor.getShapesInBox(area)) {
			const util = editor.util(shape.kind);
			if (util.group || !editor.isInFocus(shape)) continue;
			// A frame is taken only when all of it is in the marquee: a marquee drawn inside a
			// frame is after what is in it.
			if (util.frame && !encloses(area, editor.getShapePageBounds(shape))) continue;
			touched.add(editor.getSelectable(shape).id);
		}
		editor.select([...this.#initial, ...[...touched].filter((id) => !this.#initial.includes(id))]);
	}

	override onExit() {
		this.editor.brush.set(null);
	}

	override onPointerUp() {
		this.parent!.transition('idle');
	}

	override onCancel() {
		this.editor.select(this.#initial);
		this.parent!.transition('idle');
	}
}

export class SelectTool extends StateNode {
	static override id = 'select';
	static override initial = 'idle';
	static override children = () => [
		Idle,
		PointingShape,
		PointingCanvas,
		Translating,
		Resizing,
		Rotating,
		DraggingHandle,
		Editing,
		Brushing
	];
}
