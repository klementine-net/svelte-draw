/* The select tool: the cursor for each resize handle, turned with the box the handles sit on. */

import type { Handle } from '../../core/editor.ts';

/** The cursor for each handle of an upright box, as a compass angle in steps of 45°. */
const HANDLE_ANGLE: Record<Handle, number> = {
	right: 0,
	bottom_right: 1,
	bottom: 2,
	bottom_left: 3,
	left: 4,
	top_left: 5,
	top: 6,
	top_right: 7
};

const RESIZE_CURSORS = ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize'];

/** The resize cursor for a handle on a box turned by `rotation`. */
export function handleCursor(handle: Handle, rotation: number): string {
	const steps = HANDLE_ANGLE[handle] + Math.round(rotation / (Math.PI / 4));
	return RESIZE_CURSORS[((steps % 4) + 4) % 4];
}
