/* The select tool: selecting by area: a marquee, or with Alt a lasso. */

import { box, vec, type Box, type Vec } from '../../core/geometry.ts';
import { StateNode } from '../../core/state-node.ts';

/** Whether all of `inner` lies in `outer`. */
const encloses = (outer: Box, inner: Box) =>
	inner.x >= outer.x &&
	inner.y >= outer.y &&
	inner.x + inner.w <= outer.x + outer.w &&
	inner.y + inner.h <= outer.y + outer.h;

export class Brushing extends StateNode {
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

/** A freehand line is drawn; every shape it crosses is picked. */
export class Lassoing extends StateNode {
	static override id = 'lassoing';
	#initial: readonly string[] = [];
	#picked = new Set<string>();
	#last: Vec = { x: 0, y: 0 };

	override onEnter() {
		const { editor } = this;
		this.#initial = editor.inputs.shift ? editor.selection.peek() : [];
		this.#picked = new Set(this.#initial);
		this.#last = editor.inputs.originPage;
		editor.cursor.set('crosshair');
		editor.lasso.set([this.#last]);
		this.#reach();
	}

	override onPointerMove() {
		this.#reach();
	}

	/** Every shape along the way from the last point to this one. */
	#reach() {
		const { editor } = this;
		const to = editor.inputs.page;
		const from = this.#last;
		const step = 4 / editor.camera.peek().z;
		const steps = Math.max(1, Math.ceil(vec.dist(from, to) / step));
		for (let i = 1; i <= steps; i++) {
			const leaf = editor.getShapeAtPoint(vec.add(from, vec.mul(vec.sub(to, from), i / steps)));
			if (leaf && editor.isInFocus(leaf)) this.#picked.add(editor.getSelectable(leaf).id);
		}
		this.#last = to;
		editor.lasso.set([...editor.lasso.peek(), to]);
		editor.select([...this.#picked]);
	}

	override onExit() {
		this.editor.lasso.set([]);
	}

	override onPointerUp() {
		this.parent!.transition('idle');
	}

	override onCancel() {
		this.editor.select(this.#initial);
		this.parent!.transition('idle');
	}
}
