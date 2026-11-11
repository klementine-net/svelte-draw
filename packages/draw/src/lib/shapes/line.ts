/* The line shape: a straight stroke from its origin to an end, with or without an arrowhead. */

import { box, vec, type Box, type Vec } from '../core/geometry.ts';
import { STROKE_WIDTH, type ShapeRecord } from '../core/records.ts';
import { ShapeUtil, type ResizeResult } from '../core/shape-util.ts';
import { StateNode } from '../core/state-node.ts';
import type { PointerInfo } from '../core/events.ts';

export type LineProps = {
	/** Where the line ends, from its origin (where it starts). */
	dx: number;
	dy: number;
	/** True for an arrow: a head at the end. */
	arrow: boolean;
};

export type LineShape = ShapeRecord<'line', LineProps>;

export class LineShapeUtil extends ShapeUtil<LineShape> {
	static override kind = 'line';

	defaultProps(): LineProps {
		return { dx: 120, dy: 0, arrow: false };
	}

	bounds(shape: LineShape): Box {
		return box.fromPoints({ x: 0, y: 0 }, { x: shape.props.dx, y: shape.props.dy });
	}

	/** Hit when the point is on the stroke itself, not merely in its box. */
	override hitTest(shape: LineShape, point: Vec, margin: number): boolean {
		const reach = STROKE_WIDTH[shape.style.size] / 2 + margin;
		const end = { x: shape.props.dx, y: shape.props.dy };
		return vec.distToSegment(point, { x: 0, y: 0 }, end) <= reach;
	}

	override outline(shape: LineShape): string {
		return `M0,0L${shape.props.dx},${shape.props.dy}`;
	}

	resize(shape: LineShape, target: Box, flip: { x: boolean; y: boolean }): ResizeResult<LineShape> {
		// The start keeps its side of the box unless the drag crossed over.
		const startsLeft = shape.props.dx >= 0 !== flip.x;
		const startsTop = shape.props.dy >= 0 !== flip.y;
		const x = startsLeft ? target.x : target.x + target.w;
		const y = startsTop ? target.y : target.y + target.h;
		return {
			x,
			y,
			props: {
				...shape.props,
				dx: (startsLeft ? target.x + target.w : target.x) - x,
				dy: (startsTop ? target.y + target.h : target.y) - y
			}
		};
	}
}

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

	override onPointerMove() {
		if (this.editor.inputs.isDragging) this.parent!.transition('dragging');
	}

	// A click without a drag makes nothing: a line needs two ends.
	override onPointerUp() {
		this.parent!.transition('idle');
	}

	override onCancel() {
		this.parent!.transition('idle');
	}
}

class Dragging extends StateNode {
	static override id = 'dragging';
	#id = '';

	override onEnter() {
		const { editor } = this;
		editor.history.mark();
		this.#id = editor.createShape({
			kind: 'line',
			x: editor.inputs.originPage.x,
			y: editor.inputs.originPage.y,
			props: { ...this.#end(), arrow: (this.parent as LineTool).arrow }
		}).id;
	}

	override onPointerMove() {
		this.editor.updateShape(this.#id, { props: this.#end() });
	}

	override onKeyDown() {
		this.editor.updateShape(this.#id, { props: this.#end() });
	}

	override onKeyUp() {
		this.editor.updateShape(this.#id, { props: this.#end() });
	}

	#end(): { dx: number; dy: number } {
		const { inputs } = this.editor;
		let dx = inputs.page.x - inputs.originPage.x;
		let dy = inputs.page.y - inputs.originPage.y;
		// Shift holds the line to steps of 15 degrees.
		if (inputs.shift) {
			const length = Math.hypot(dx, dy);
			const step = Math.PI / 12;
			const angle = Math.round(Math.atan2(dy, dx) / step) * step;
			dx = Math.cos(angle) * length;
			dy = Math.sin(angle) * length;
		}
		return { dx, dy };
	}

	override onPointerUp() {
		const { editor } = this;
		editor.history.mark();
		editor.select([this.#id]);
		editor.setTool('select');
	}

	override onCancel() {
		this.editor.history.bail();
		this.parent!.transition('idle');
	}
}

export class LineTool extends StateNode {
	static override id = 'line';
	static override initial = 'idle';
	static override children = () => [Idle, Pointing, Dragging];

	/** Whether the lines this tool makes have an arrowhead. */
	arrow = false;
}

export class ArrowTool extends LineTool {
	static override id = 'arrow';
	override arrow = true;
}
