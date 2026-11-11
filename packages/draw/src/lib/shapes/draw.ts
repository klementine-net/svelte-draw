/* The draw shape: one freehand stroke, and the tool that makes it. */

import { vec, type Box, type Vec } from '../core/geometry.ts';
import { STROKE_WIDTH, type ShapeRecord, type StyleKey } from '../core/records.ts';
import { ShapeUtil, type ResizeResult } from '../core/shape-util.ts';
import { StateNode } from '../core/state-node.ts';
import type { PointerInfo } from '../core/events.ts';
import type { InkPoint } from './sketch.ts';

export type DrawProps = {
	/** The stroke, relative to the shape's origin (where the pen went down). */
	points: InkPoint[];
	/** True when the pressures are real (a pen), false when they are to be made up (a mouse). */
	pen: boolean;
	/** False while the stroke is still being drawn. */
	done: boolean;
	/** True for a highlighter's stroke: wide, even and see-through. */
	highlight?: boolean;
};

export type DrawShape = ShapeRecord<'draw', DrawProps>;

/** The width of a freehand stroke at full pressure, for each stroke width. */
export function inkSize(shape: DrawShape): number {
	return STROKE_WIDTH[shape.style.size] * (shape.props.highlight ? 6 : 2);
}

export class DrawShapeUtil extends ShapeUtil<DrawShape> {
	static override kind = 'draw';
	override readonly styles: readonly StyleKey[] = ['color', 'size', 'opacity'];

	override canBind() {
		return false;
	}

	defaultProps(): DrawProps {
		return { points: [], pen: false, done: false };
	}

	bounds(shape: DrawShape): Box {
		const { points } = shape.props;
		if (points.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
		let minX = Infinity;
		let minY = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;
		for (const [x, y] of points) {
			minX = Math.min(minX, x);
			minY = Math.min(minY, y);
			maxX = Math.max(maxX, x);
			maxY = Math.max(maxY, y);
		}
		return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
	}

	/** Hit when the point is on the stroke itself, not merely in its box. */
	override hitTest(shape: DrawShape, point: Vec, margin: number): boolean {
		const { points } = shape.props;
		const reach = inkSize(shape) / 2 + margin;
		if (points.length === 1) return vec.dist(point, { x: points[0][0], y: points[0][1] }) <= reach;
		for (let i = 1; i < points.length; i++) {
			const a = { x: points[i - 1][0], y: points[i - 1][1] };
			const b = { x: points[i][0], y: points[i][1] };
			if (vec.distToSegment(point, a, b) <= reach) return true;
		}
		return false;
	}

	resize(shape: DrawShape, target: Box, flip: { x: boolean; y: boolean }): ResizeResult<DrawShape> {
		const from = this.bounds(shape);
		const scaleX = from.w > 0 ? target.w / from.w : 1;
		const scaleY = from.h > 0 ? target.h / from.h : 1;
		// The stroke is rescaled so its bounds start at the origin, and the origin moves to the target.
		const points = shape.props.points.map(([x, y, pressure]): InkPoint => [
			(flip.x ? from.x + from.w - x : x - from.x) * scaleX,
			(flip.y ? from.y + from.h - y : y - from.y) * scaleY,
			pressure
		]);
		return { x: target.x, y: target.y, props: { ...shape.props, points } };
	}
}

class Idle extends StateNode {
	static override id = 'idle';

	override onEnter() {
		this.editor.cursor.set('crosshair');
	}

	override onPointerDown(event: PointerInfo) {
		if (event.button === 0) this.parent!.transition('drawing');
	}

	override onCancel() {
		this.editor.setTool('select');
	}
}

class Drawing extends StateNode {
	static override id = 'drawing';
	#id = '';
	#origin: Vec = { x: 0, y: 0 };
	#points: InkPoint[] = [];

	override onEnter() {
		const { editor } = this;
		const { page, pressure, isPen } = editor.inputs;
		editor.history.mark();
		this.#origin = page;
		this.#points = [[0, 0, pressure]];
		this.#id = editor.createShape({
			kind: 'draw',
			x: page.x,
			y: page.y,
			props: {
				points: this.#points,
				pen: isPen,
				done: false,
				highlight: (this.parent as DrawTool).highlight
			}
		}).id;
	}

	override onPointerMove() {
		const { editor } = this;
		const { page, pressure } = editor.inputs;
		const last = this.#points[this.#points.length - 1];
		const next: InkPoint = [page.x - this.#origin.x, page.y - this.#origin.y, pressure];
		// Skip moves too small to see at this zoom.
		if (Math.hypot(next[0] - last[0], next[1] - last[1]) < 1 / editor.camera.peek().z) return;
		this.#points = [...this.#points, next];
		editor.updateShape(this.#id, { props: { points: this.#points } });
	}

	override onPointerUp() {
		this.editor.updateShape(this.#id, { props: { done: true } });
		this.editor.settle([this.#id]);
		this.editor.history.mark();
		this.parent!.transition('idle');
	}

	override onCancel() {
		this.editor.history.bail();
		this.parent!.transition('idle');
	}
}

export class DrawTool extends StateNode {
	static override id = 'draw';
	static override initial = 'idle';
	static override children = () => [Idle, Drawing];

	/** Whether the strokes this tool makes are a highlighter's. */
	highlight = false;
}

export class HighlightTool extends DrawTool {
	static override id = 'highlight';
	override highlight = true;
}
