/*
 * The group: a shape that is nothing but the shapes in it. It has no picture and no size of
 * its own; its box is the box around its children, and a click on any of them picks it.
 */

import { box, vec, type Box } from '../core/geometry.ts';
import type { ShapeRecord, StyleKey } from '../core/records.ts';
import { ShapeUtil, type ResizeResult } from '../core/shape-util.ts';

export type GroupShape = ShapeRecord<'group', Record<string, never>>;

export class GroupShapeUtil extends ShapeUtil<GroupShape> {
	static override kind = 'group';
	override readonly group = true;
	override readonly styles: readonly StyleKey[] = [];

	defaultProps() {
		return {};
	}

	/** The box around everything in the group, in the group's space. */
	bounds(shape: GroupShape): Box {
		const { editor } = this;
		const corners = editor
			.getChildren(shape.id)
			.flatMap((child) =>
				box
					.corners(editor.util(child.kind).bounds(child))
					.map((corner) => vec.add(vec.rotate(corner, child.rotation ?? 0), child))
			);
		return corners.length > 0 ? box.around(corners) : { x: 0, y: 0, w: 0, h: 0 };
	}

	/** Never hit itself: its children are, and the editor picks the group for them. */
	override hitTest() {
		return false;
	}

	override canBind() {
		return false;
	}

	/** The editor resizes what is in the group; the group itself has nothing to change. */
	resize(shape: GroupShape): ResizeResult<GroupShape> {
		return { x: shape.x, y: shape.y, props: shape.props };
	}
}
