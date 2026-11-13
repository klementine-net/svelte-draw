/* The editor's fixed numbers and names, shared by its modules. */

export const HANDLES = [
	'top_left',
	'top_right',
	'bottom_right',
	'bottom_left',
	'top',
	'right',
	'bottom',
	'left'
] as const;
export type Handle = (typeof HANDLES)[number];

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 8;
export const ZOOM_STEPS = [0.1, 0.25, 0.5, 1, 2, 4, 8];
/** How far the pointer travels (screen px) before a press counts as a drag. */
export const DRAG_DISTANCE = 4;
/** How close (screen px) the pointer must be to grab a shape's edge or a handle. */
export const HIT_MARGIN = 6;
/** How far above the selection (screen px) the handle that turns it sits. */
export const ROTATE_HANDLE_DISTANCE = 24;
/** How close to the canvas's edge (screen px) a drag starts to move the view, and how fast. */
export const EDGE_ZONE = 24;
export const EDGE_SPEED = 14;
/** The grid's step, in page units. */
export const GRID_SIZE = 24;
/** How close (screen px) an edge must come to another shape's to snap to it. */
export const SNAP_DISTANCE = 7;

/** An angle brought into (−π, π], with what is as good as zero made zero. */
export function tidyAngle(angle: number): number {
	let a = angle % (Math.PI * 2);
	if (a > Math.PI) a -= Math.PI * 2;
	if (a <= -Math.PI) a += Math.PI * 2;
	return Math.abs(a) < 1e-9 ? 0 : a;
}
