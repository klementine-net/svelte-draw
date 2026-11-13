/* The select tool: a press that has not moved yet: on a shape, or on the empty canvas. */

import { StateNode } from '../../core/state-node.ts';
import type { PointerInfo } from '../../core/events.ts';

export interface PointingShapeInfo {
	collapseTo: string | null;
	clearOnClick?: boolean;
}

export class PointingShape extends StateNode {
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

export class PointingCanvas extends StateNode {
	static override id = 'pointing_canvas';

	/** A drag draws a marquee; with Alt held, a lasso. */
	override onPointerMove() {
		const { inputs } = this.editor;
		if (inputs.isDragging) this.parent!.transition(inputs.alt ? 'lassoing' : 'brushing');
	}

	override onPointerUp(event: PointerInfo) {
		if (!event.shift) this.editor.select([]);
		this.parent!.transition('idle');
	}

	override onCancel() {
		this.parent!.transition('idle');
	}
}
