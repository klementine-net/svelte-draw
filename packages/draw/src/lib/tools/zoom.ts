/*
 * The zoom tool: a click zooms in on that point (with Alt: out), a drag draws a box and
 * zooms to it. Then the tool hands back to select.
 */

import { box } from '../core/geometry.ts';
import { StateNode } from '../core/state-node.ts';
import type { PointerInfo } from '../core/events.ts';

class Idle extends StateNode {
	static override id = 'idle';

	override onEnter() {
		this.#cursor();
	}

	override onKeyDown() {
		this.#cursor();
	}

	override onKeyUp() {
		this.#cursor();
	}

	#cursor() {
		this.editor.cursor.set(this.editor.inputs.alt ? 'zoom-out' : 'zoom-in');
	}

	override onPointerDown(event: PointerInfo) {
		if (event.button === 0) this.parent!.transition('pointing');
	}

	override onCancel() {
		this.editor.setTool('select');
	}
}

class Pointing extends StateNode {
	static override id = 'pointing';

	override onPointerMove() {
		const { editor } = this;
		if (editor.inputs.isDragging)
			editor.brush.set(box.fromPoints(editor.inputs.originPage, editor.inputs.page));
	}

	override onPointerUp() {
		const { editor } = this;
		const area = editor.brush.peek();
		if (area && area.w > 4 && area.h > 4) editor.zoomToBounds(area, 0);
		else {
			const z = editor.camera.peek().z;
			editor.zoomTo(editor.inputs.alt ? z / 2 : z * 2, editor.inputs.screen);
		}
		editor.setTool('select');
	}

	override onExit() {
		this.editor.brush.set(null);
	}

	override onCancel() {
		this.editor.setTool('select');
	}
}

export class ZoomTool extends StateNode {
	static override id = 'zoom';
	static override initial = 'idle';
	static override children = () => [Idle, Pointing];
}
