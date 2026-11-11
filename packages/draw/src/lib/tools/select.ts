/*
 * The select tool: pick, move, resize, marquee. Each interaction is its own state, so „what
 * does a pointer move mean right now“ is answered by which state is active, never by flags.
 *
 *   idle ─ press a handle ──────────────→ resizing
 *        ─ press a shape or selection ──→ pointing_shape ─ drag → translating
 *        ─ press the canvas ────────────→ pointing_canvas ─ drag → brushing
 *        ─ double click, or Enter ──────→ editing (shapes whose util says `canEdit`)
 */

import { box, type Box, type Vec } from '../core/geometry.ts';
import type { ShapeRecord } from '../core/records.ts';
import type { Handle } from '../core/editor.ts';
import { StateNode } from '../core/state-node.ts';
import type { KeyInfo, PointerInfo } from '../core/events.ts';

const HANDLE_CURSOR: Record<Handle, string> = {
	top_left: 'nwse-resize',
	bottom_right: 'nwse-resize',
	top_right: 'nesw-resize',
	bottom_left: 'nesw-resize',
	top: 'ns-resize',
	bottom: 'ns-resize',
	left: 'ew-resize',
	right: 'ew-resize'
};

class Idle extends StateNode {
	static override id = 'idle';

	override onEnter() {
		this.editor.cursor.set('default');
	}

	override onExit() {
		this.editor.hovered.set(null);
	}

	override onPointerMove() {
		const { editor } = this;
		const handle = editor.getHandleAt(editor.inputs.screen);
		editor.cursor.set(handle ? HANDLE_CURSOR[handle] : 'default');
		editor.hovered.set(handle ? null : (editor.getShapeAtPoint(editor.inputs.page)?.id ?? null));
	}

	override onPointerDown(event: PointerInfo) {
		const { editor } = this;
		if (event.button !== 0) return;

		const handle = editor.getHandleAt(editor.inputs.screen);
		if (handle) return this.parent!.transition('resizing', { handle });

		const hit = editor.getShapeAtPoint(editor.inputs.page);
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
		if (bounds && box.contains(bounds, editor.inputs.page))
			return this.parent!.transition('pointing_shape', { collapseTo: null, clearOnClick: true });

		this.parent!.transition('pointing_canvas');
	}

	override onDoubleClick() {
		const { editor } = this;
		const hit = editor.getShapeAtPoint(editor.inputs.page);
		if (hit) editor.startEditing(hit.id);
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
			case ']':
				return editor.bringToFront();
			case '[':
				return editor.sendToBack();
		}
	}

	override onCancel() {
		this.editor.select([]);
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
		if (this.editor.inputs.isDragging && this.editor.selection.peek().length > 0)
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
	#start: { id: string; x: number; y: number }[] = [];

	override onEnter() {
		const { editor } = this;
		editor.history.mark();
		editor.cursor.set('move');
		this.#start = editor.getSelectedShapes().map(({ id, x, y }) => ({ id, x, y }));
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
		const { inputs } = this.editor;
		let dx = inputs.page.x - inputs.originPage.x;
		let dy = inputs.page.y - inputs.originPage.y;
		// Shift keeps the move on one axis.
		if (inputs.shift) {
			if (Math.abs(dx) > Math.abs(dy)) dy = 0;
			else dx = 0;
		}
		this.editor.updateShapes(this.#start.map(({ id, x, y }) => ({ id, x: x + dx, y: y + dy })));
	}

	override onPointerUp() {
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
}

class Resizing extends StateNode {
	static override id = 'resizing';
	#handle: Handle = 'bottom_right';
	#creating = false;
	#bounds: Box = { x: 0, y: 0, w: 0, h: 0 };
	#start: { shape: ShapeRecord; bounds: Box; parentOrigin: Vec }[] = [];

	override onEnter(info: unknown) {
		const { editor } = this;
		const { handle, creating } = info as ResizingInfo;
		if (!creating) editor.history.mark();
		this.#handle = handle;
		this.#creating = !!creating;
		this.#bounds = editor.getSelectionBounds() ?? { x: 0, y: 0, w: 0, h: 0 };
		this.#start = editor.getSelectedShapes().map((shape) => {
			const origin = editor.getShapePageOrigin(shape);
			return {
				shape,
				bounds: editor.getShapePageBounds(shape),
				parentOrigin: { x: origin.x - shape.x, y: origin.y - shape.y }
			};
		});
		editor.cursor.set(HANDLE_CURSOR[handle]);
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
		const p = editor.inputs.page;
		const handle = this.#handle;

		// The dragged edges follow the pointer; the others stay.
		let left = b.x;
		let right = b.x + b.w;
		let top = b.y;
		let bottom = b.y + b.h;
		const movesLeft = handle.includes('left');
		const movesRight = handle.includes('right');
		const movesTop = handle.includes('top');
		const movesBottom = handle.includes('bottom');
		if (movesLeft) left = p.x;
		if (movesRight) right = p.x;
		if (movesTop) top = p.y;
		if (movesBottom) bottom = p.y;

		// Shift on a corner keeps the proportions.
		const isCorner = (movesLeft || movesRight) && (movesTop || movesBottom);
		if (editor.inputs.shift && isCorner && b.w > 0 && b.h > 0) {
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
			this.#start.map(({ shape, bounds, parentOrigin }) => {
				const target = box.fromPoints(
					{ x: left + (bounds.x - b.x) * scaleX, y: top + (bounds.y - b.y) * scaleY },
					{
						x: left + (bounds.x + bounds.w - b.x) * scaleX,
						y: top + (bounds.y + bounds.h - b.y) * scaleY
					}
				);
				const inParent = box.translate(target, { x: -parentOrigin.x, y: -parentOrigin.y });
				return { id: shape.id, ...editor.util(shape.kind).resize(shape, inParent, flip) };
			})
		);
	}

	override onPointerUp() {
		const { editor } = this;
		editor.history.mark();
		// A new shape that holds text is typed into straight away.
		const selection = editor.selection.peek();
		if (this.#creating && selection.length === 1 && editor.canEdit(selection[0]))
			return editor.startEditing(selection[0]);
		this.parent!.transition('idle');
	}

	override onCancel() {
		this.editor.history.bail();
		this.parent!.transition('idle');
	}
}

/**
 * A shape's content is being typed into. The typing itself happens in the shape's view; this
 * state only holds the canvas still meanwhile and makes the whole edit one undo step.
 */
class Editing extends StateNode {
	static override id = 'editing';

	override onEnter(info: unknown) {
		const { editor } = this;
		editor.history.mark();
		editor.editing.set((info as { id: string }).id);
		editor.cursor.set('default');
	}

	override onExit() {
		this.editor.editing.set(null);
		this.editor.history.mark();
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
		const touched = editor.getShapesInBox(area).map((shape) => shape.id);
		editor.select([...this.#initial, ...touched.filter((id) => !this.#initial.includes(id))]);
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
		Editing,
		Brushing
	];
}
