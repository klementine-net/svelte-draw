/* The select tool: the selection follows the pointer. */

import { box, vec, type Box } from '../../core/geometry.ts';
import { StateNode } from '../../core/state-node.ts';

export class Translating extends StateNode {
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
