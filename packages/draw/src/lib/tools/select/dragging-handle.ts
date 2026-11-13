/* The select tool: one of a shape's own handles (a line's end) follows the pointer. */

import { StateNode } from '../../core/state-node.ts';

export interface DraggingHandleInfo {
	/** The id of the shape's handle, as its util names it. */
	handle: string;
	/** True when the shape was just made by a tool: the same undo step as its creation. */
	creating?: boolean;
}

/** One of the selected shape's own handles follows the pointer; what that means is the util's. */
export class DraggingHandle extends StateNode {
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
