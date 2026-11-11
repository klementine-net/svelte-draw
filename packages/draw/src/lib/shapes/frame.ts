/*
 * The frame: a named box that holds shapes. What is dropped on it becomes its child, moves
 * with it and is cut off at its edge. Its inside is not the frame: it is picked by its edge
 * or its name, so shapes in it can be worked on as usual.
 */

import { box, polygon, type Box, type Vec } from '../core/geometry.ts';
import type { ShapeRecord, StyleKey } from '../core/records.ts';
import { ShapeUtil, type ResizeResult } from '../core/shape-util.ts';
import { BoxTool } from '../tools/box-tool.ts';

export type FrameProps = { w: number; h: number; name: string };
export type FrameShape = ShapeRecord<'frame', FrameProps>;

/** The strip above the frame where its name sits (page units). */
export const FRAME_NAME_HEIGHT = 24;

export class FrameShapeUtil extends ShapeUtil<FrameShape> {
	static override kind = 'frame';
	override readonly frame = true;
	override readonly styles: readonly StyleKey[] = [];

	defaultProps(): FrameProps {
		return { w: 480, h: 320, name: 'Frame' };
	}

	bounds(shape: FrameShape): Box {
		return { x: 0, y: 0, w: shape.props.w, h: shape.props.h };
	}

	/** Its name is what can be typed into. */
	override canEdit() {
		return true;
	}

	override hitTest(shape: FrameShape, point: Vec, margin: number): boolean {
		const width = Math.min(shape.props.w, 200);
		const name = { x: 0, y: -FRAME_NAME_HEIGHT, w: width, h: FRAME_NAME_HEIGHT };
		return (
			box.contains(name, point) ||
			polygon.distance(box.corners(this.bounds(shape)), point) <= margin + 1
		);
	}

	resize(shape: FrameShape, target: Box): ResizeResult<FrameShape> {
		return {
			x: target.x,
			y: target.y,
			props: { ...shape.props, w: Math.max(40, target.w), h: Math.max(40, target.h) }
		};
	}
}

export class FrameTool extends BoxTool {
	static override id = 'frame';
	shape = { kind: 'frame' };
}
