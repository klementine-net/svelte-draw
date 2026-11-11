/*
 * The laser pointer: press and drag to point something out. The trail is shown to everyone
 * looking at the document and fades soon after; nothing is written to the document.
 */

import { StateNode } from '../core/state-node.ts';
import type { PointerInfo } from '../core/events.ts';

/** How long (ms) the trail stays after the pointer is lifted. */
const LINGER = 900;
/** The longest the trail gets, in points. */
const LENGTH = 60;

class Idle extends StateNode {
	static override id = 'idle';

	override onEnter() {
		this.editor.cursor.set('crosshair');
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
	#fade: ReturnType<typeof setTimeout> | undefined;

	override onEnter() {
		clearTimeout(this.#fade);
		this.editor.laser.set([this.editor.inputs.page]);
	}

	override onPointerMove() {
		const { editor } = this;
		editor.laser.set([...editor.laser.peek(), editor.inputs.page].slice(-LENGTH));
	}

	override onPointerUp() {
		this.parent!.transition('idle');
	}

	override onCancel() {
		this.parent!.transition('idle');
	}

	override onExit() {
		const { editor } = this;
		this.#fade = setTimeout(() => editor.laser.set([]), LINGER);
		(this.#fade as { unref?: () => void }).unref?.();
	}
}

export class LaserTool extends StateNode {
	static override id = 'laser';
	static override initial = 'idle';
	static override children = () => [Idle, Pointing];
}
