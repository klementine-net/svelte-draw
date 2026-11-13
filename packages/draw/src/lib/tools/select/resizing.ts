/* The select tool: a handle of the selection's box follows the pointer. */

import { box, vec, type Box } from '../../core/geometry.ts';
import type { ShapeRecord } from '../../core/records.ts';
import type { Handle } from '../../core/editor.ts';
import { StateNode } from '../../core/state-node.ts';
import { handleCursor } from './cursors.ts';

export interface ResizingInfo {
	handle: Handle;
	/** True when the shape was just made by a tool: the same undo step as its creation. */
	creating?: boolean;
	/** True when the shape is typed into as soon as it has its size. */
	edit?: boolean;
}

export class Resizing extends StateNode {
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

		// Alt resizes from the middle: the opposite edge moves the other way.
		if (editor.inputs.alt) {
			if (movesLeft) right = b.x * 2 + b.w - left;
			else if (movesRight) left = b.x * 2 + b.w - right;
			if (movesTop) bottom = b.y * 2 + b.h - top;
			else if (movesBottom) top = b.y * 2 + b.h - bottom;
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
