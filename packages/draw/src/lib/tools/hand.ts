/* The hand tool: drag to move the view. */

import { StateNode } from '../core/state-node.ts';
import type { PointerInfo } from '../core/events.ts';

class Idle extends StateNode {
	static override id = 'idle';

	override onEnter() {
		this.editor.cursor.set('grab');
	}

	override onPointerDown(event: PointerInfo) {
		if (event.button === 0) this.parent!.transition('dragging');
	}
}

class Dragging extends StateNode {
	static override id = 'dragging';
	#last = { x: 0, y: 0 };

	override onEnter() {
		this.editor.cursor.set('grabbing');
		this.#last = this.editor.inputs.screen;
	}

	override onPointerMove() {
		const { screen } = this.editor.inputs;
		this.editor.pan(screen.x - this.#last.x, screen.y - this.#last.y);
		this.#last = screen;
	}

	override onPointerUp() {
		this.parent!.transition('idle');
	}

	override onCancel() {
		this.parent!.transition('idle');
	}
}

export class HandTool extends StateNode {
	static override id = 'hand';
	static override initial = 'idle';
	static override children = () => [Idle, Dragging];
}
