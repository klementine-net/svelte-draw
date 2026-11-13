/*
 * Two fingers on a touch screen move and zoom the view, whatever the tool. This keeps track
 * of the fingers; the canvas tells it about every touch and asks whether a pinch is on.
 */

import type { Editor, Vec } from '../../index.ts';

/** `editor` is asked for each time, so a canvas given another editor pinches that one. */
export function createPinch(editor: () => Editor) {
	const fingers = new Map<number, Vec>();
	let pinch: { distance: number; middle: Vec } | null = null;
	const now = () => {
		const [a, b] = [...fingers.values()];
		return {
			distance: Math.hypot(a.x - b.x, a.y - b.y),
			middle: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
		};
	};

	return {
		/** True while two fingers are (or were just) down: one finger left over does nothing. */
		get active() {
			return pinch !== null;
		},
		/** A finger went down at `point`. True when it is the second one: a pinch begins. */
		down(id: number, point: Vec): boolean {
			fingers.set(id, point);
			if (fingers.size !== 2) return false;
			pinch = now();
			return true;
		},
		/** A pointer moved. True while a pinch is on: the move was the pinch's, not a tool's. */
		move(id: number, point: Vec): boolean {
			if (fingers.has(id)) fingers.set(id, point);
			if (!pinch) return false;
			if (fingers.size < 2) return true;
			const next = now();
			const target = editor();
			target.pan(next.middle.x - pinch.middle.x, next.middle.y - pinch.middle.y);
			if (pinch.distance > 0)
				target.zoomTo(target.camera.peek().z * (next.distance / pinch.distance), next.middle);
			pinch = next;
			return true;
		},
		/** A pointer went up or was taken away. A pinch is over once both fingers are up. */
		up(id: number) {
			fingers.delete(id);
			if (pinch && fingers.size === 0) pinch = null;
		}
	};
}
