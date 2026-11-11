/*
 * The eraser: press and drag over shapes; each one touched fades, and all of them are removed
 * on release. Escape during the drag keeps them.
 */

import type { Vec } from '../core/geometry.ts';
import { StateNode } from '../core/state-node.ts';
import type { PointerInfo } from '../core/events.ts';

class Idle extends StateNode {
	static override id = 'idle';

	override onEnter() {
		this.editor.cursor.set('crosshair');
	}

	override onPointerDown(event: PointerInfo) {
		if (event.button === 0) this.parent!.transition('erasing');
	}

	override onCancel() {
		this.editor.setTool('select');
	}
}

class Erasing extends StateNode {
	static override id = 'erasing';
	#ids = new Set<string>();
	#last: Vec = { x: 0, y: 0 };

	override onEnter() {
		this.#ids = new Set();
		this.#last = this.editor.inputs.page;
		this.#touch(this.#last);
	}

	/** Every shape along the way from the last point to this one, so a fast drag misses none. */
	override onPointerMove() {
		const { editor } = this;
		const to = editor.inputs.page;
		const from = this.#last;
		const step = 4 / editor.camera.peek().z;
		const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / step));
		for (let i = 1; i <= steps; i++)
			this.#touch({
				x: from.x + ((to.x - from.x) * i) / steps,
				y: from.y + ((to.y - from.y) * i) / steps
			});
		this.#last = to;
	}

	#touch(point: Vec) {
		const hit = this.editor.getShapeAtPoint(point);
		if (!hit || this.#ids.has(hit.id)) return;
		this.#ids.add(hit.id);
		this.editor.erasing.set([...this.#ids]);
	}

	override onPointerUp() {
		const { editor } = this;
		if (this.#ids.size > 0) {
			editor.history.mark();
			editor.deleteShapes([...this.#ids]);
			editor.history.mark();
		}
		this.parent!.transition('idle');
	}

	override onCancel() {
		this.parent!.transition('idle');
	}

	override onExit() {
		this.editor.erasing.set([]);
	}
}

export class EraserTool extends StateNode {
	static override id = 'eraser';
	static override initial = 'idle';
	static override children = () => [Idle, Erasing];
}
