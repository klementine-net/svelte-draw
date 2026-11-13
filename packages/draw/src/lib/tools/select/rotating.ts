/* The select tool: the selection turns around its middle. */

import { box, vec, type Vec } from '../../core/geometry.ts';
import type { ShapeRecord } from '../../core/records.ts';
import { StateNode } from '../../core/state-node.ts';

/** The selection turns around its middle, following the pointer. Shift: steps of 15 degrees. */
export class Rotating extends StateNode {
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
