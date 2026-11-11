/*
 * A ShapeUtil is everything the core needs to know about one kind of shape: its default props,
 * where it is, what counts as touching it, how it resizes. It holds no shape; the editor hands
 * it the record each time. How a shape looks is not here: the renderer pairs each kind with a
 * view (see svelte/plugin.ts), so the core runs without a UI.
 *
 * A new kind of shape is a subclass, registered through a plugin.
 */

import { box, type Box, type Vec } from './geometry.ts';
import type { ShapeRecord } from './records.ts';
import type { Editor } from './editor.ts';

export interface ShapeUtilConstructor {
	new (editor: Editor): ShapeUtil<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
	kind: string;
}

/** What `resize` returns: the shape's new place and props. */
export interface ResizeResult<S extends ShapeRecord> {
	x: number;
	y: number;
	props: S['props'];
}

export abstract class ShapeUtil<S extends ShapeRecord = ShapeRecord> {
	/** The `kind` of the records this util owns. */
	static kind: string;

	readonly editor: Editor;

	constructor(editor: Editor) {
		this.editor = editor;
	}

	/** Props of a new shape of this kind. */
	abstract defaultProps(): S['props'];

	/** The shape's bounds in its own space (its `x`/`y` is the origin). */
	abstract bounds(shape: S): Box;

	/** Whether `point` (in the shape's own space) touches the shape, within `margin`. */
	hitTest(shape: S, point: Vec, margin: number): boolean {
		return box.contains(this.bounds(shape), point, margin);
	}

	/** The outline shown while the shape is hovered or selected: an SVG path in its own space. */
	outline(shape: S): string {
		const b = this.bounds(shape);
		return `M${b.x},${b.y}h${b.w}v${b.h}h${-b.w}z`;
	}

	canResize(_shape: S): boolean {
		return true;
	}

	/**
	 * The shape after its bounds are moved to `target` (in the parent's space). `shape` is the
	 * shape as it was when the resize began; `flip` says whether the drag crossed over an axis.
	 */
	abstract resize(shape: S, target: Box, flip: { x: boolean; y: boolean }): ResizeResult<S>;
}
