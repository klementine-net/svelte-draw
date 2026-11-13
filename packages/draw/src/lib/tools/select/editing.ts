/* The select tool: a shape's content is being typed into. */

import { StateNode } from '../../core/state-node.ts';
import type { PointerInfo } from '../../core/events.ts';

export interface EditingInfo {
	id: string;
	/** True when the shape was just made: making it and typing into it are one undo step. */
	creating?: boolean;
}

/**
 * A shape's content is being typed into. The typing itself happens in the shape's view; this
 * state only holds the canvas still meanwhile and makes the whole edit one undo step.
 */
export class Editing extends StateNode {
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
