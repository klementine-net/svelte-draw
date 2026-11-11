/*
 * What the renderer tells the editor. The renderer translates DOM events into these and calls
 * `editor.dispatch`; nothing below this line knows about the DOM, which is why tools can be
 * driven from a test (or a script) with the same calls.
 */

import type { Vec } from './geometry.ts';

interface Modifiers {
	shift: boolean;
	alt: boolean;
	/** Ctrl, or Command on a Mac. */
	meta: boolean;
}

export interface PointerInfo extends Modifiers {
	type: 'pointer' | 'double_click';
	name: 'down' | 'move' | 'up';
	/** Where the pointer is, in pixels from the canvas's top left. */
	point: Vec;
	/** 0 primary, 1 middle, 2 secondary. */
	button: number;
	/** 0–1 from a pen; 0.5 where the device reports none. */
	pressure: number;
	isPen: boolean;
}

export interface KeyInfo extends Modifiers {
	type: 'key';
	name: 'down' | 'up';
	/** `KeyboardEvent.key`: `a`, `Delete`, `ArrowLeft`. */
	key: string;
	repeat: boolean;
}

export interface WheelInfo extends Modifiers {
	type: 'wheel';
	point: Vec;
	delta: Vec;
}

export interface CancelInfo {
	type: 'cancel';
}

export type DrawEvent = PointerInfo | KeyInfo | WheelInfo | CancelInfo;
