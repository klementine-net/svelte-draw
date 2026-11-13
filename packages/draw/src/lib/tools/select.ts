/*
 * The select tool: pick, move, resize, turn, marquee. Each interaction is its own state, so
 * „what does a pointer move mean right now“ is answered by which state is active, never by
 * flags.
 *
 *   idle ─ press a shape's own handle ──→ dragging_handle (a line's end)
 *        ─ press the turn handle ───────→ rotating
 *        ─ press a resize handle ───────→ resizing
 *        ─ press a shape or selection ──→ pointing_shape ─ drag → translating
 *        ─ press the canvas ────────────→ pointing_canvas ─ drag → brushing (Alt: lassoing)
 *        ─ double click, or Enter ──────→ editing (shapes whose util says `canEdit`)
 */

import { StateNode } from '../core/state-node.ts';
import { Brushing, Lassoing } from './select/brushing.ts';
import { DraggingHandle } from './select/dragging-handle.ts';
import { Editing } from './select/editing.ts';
import { Idle } from './select/idle.ts';
import { PointingCanvas, PointingShape } from './select/pointing.ts';
import { Resizing } from './select/resizing.ts';
import { Rotating } from './select/rotating.ts';
import { Translating } from './select/translating.ts';

export type { DraggingHandleInfo } from './select/dragging-handle.ts';
export type { EditingInfo } from './select/editing.ts';
export type { ResizingInfo } from './select/resizing.ts';

export class SelectTool extends StateNode {
	static override id = 'select';
	static override initial = 'idle';
	static override children = () => [
		Idle,
		PointingShape,
		PointingCanvas,
		Translating,
		Resizing,
		Rotating,
		DraggingHandle,
		Editing,
		Brushing,
		Lassoing
	];
}
