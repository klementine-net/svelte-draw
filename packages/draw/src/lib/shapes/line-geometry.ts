/*
 * How a line runs. Either end can be attached to another shape. An attached end is not stored
 * as a place: the line holds the shape's id and works out where the end is each time it is
 * asked, aimed at the shape's middle and stopped at its edge. So when the shape moves, nothing
 * is written to the line; it simply reads differently, on every screen.
 */

import { box, vec, type Vec } from '../core/geometry.ts';
import { STROKE_WIDTH, type ShapeRecord } from '../core/records.ts';
import type { Editor } from '../core/editor.ts';

export type LineProps = {
	/** Where the line ends, from its origin (where it starts). */
	dx: number;
	dy: number;
	/** True for an arrow: a head at the end. */
	arrow: boolean;
	/** The shape the start is attached to. While it is, the origin is only where it last was. */
	start?: string | null;
	/** The shape the end is attached to. While it is, `dx`/`dy` are only where it last was. */
	end?: string | null;
	/** True for a head at the start too (or only there). */
	arrowStart?: boolean;
	/** The words written on the line, at its middle. */
	text?: string;
	/** How far the middle of the line is pulled to its side: 0 or not there for a straight line. */
	bend?: number;
	/** True for a line that runs in right angles: out, across, in. */
	elbow?: boolean;
};

export type LineShape = ShapeRecord<'line', LineProps>;

/** The space (page px) between an attached end and the shape's edge. */
const GAP = 5;

/** The point a bent line's curve is pulled towards: twice the bend out from the middle. */
function controlPoint(start: Vec, end: Vec, bend: number): Vec {
	const dx = end.x - start.x;
	const dy = end.y - start.y;
	const length = Math.hypot(dx, dy) || 1;
	return {
		x: (start.x + end.x) / 2 - (dy / length) * bend * 2,
		y: (start.y + end.y) / 2 + (dx / length) * bend * 2
	};
}

/**
 * The two corners of a right-angled line from `a` to `b`: across first when the two are
 * further apart sideways (`sideways`), down first otherwise.
 */
function elbowCorners(a: Vec, b: Vec, sideways: boolean): [Vec, Vec] {
	if (sideways) {
		const x = (a.x + b.x) / 2;
		return [
			{ x, y: a.y },
			{ x, y: b.y }
		];
	}
	const y = (a.y + b.y) / 2;
	return [
		{ x: a.x, y },
		{ x: b.x, y }
	];
}

/**
 * Where the line's two ends are, in the line's own space, attached ends worked out.
 * `sideways` says which way a right-angled line sets out (see `elbowCorners`).
 */
export function lineEnds(
	editor: Editor,
	shape: LineShape
): { start: Vec; end: Vec; sideways: boolean } {
	const rawStart = { x: 0, y: 0 };
	const rawEnd = { x: shape.props.dx, y: shape.props.dy };
	const startTarget = shape.props.start ? editor.getShape(shape.props.start) : undefined;
	const endTarget = shape.props.end ? editor.getShape(shape.props.end) : undefined;
	if (!startTarget && !endTarget)
		return {
			start: rawStart,
			end: rawEnd,
			sideways: Math.abs(rawEnd.x) >= Math.abs(rawEnd.y)
		};

	const middle = (target: ShapeRecord) =>
		editor.shapeToPage(target, box.center(editor.util(target.kind).bounds(target)));
	// Each end aims at the other: at its shape's middle if it is attached, at itself if not.
	const aimStart = startTarget ? middle(startTarget) : editor.shapeToPage(shape, rawStart);
	const aimEnd = endTarget ? middle(endTarget) : editor.shapeToPage(shape, rawEnd);
	const gap = GAP + STROKE_WIDTH[shape.style.size] / 2;

	// Worked out in the target's own space, so a turned shape stops the line at its turned edge.
	const stop = (target: ShapeRecord, from: Vec, to: Vec): Vec => {
		const edge = editor.shapeToPage(
			target,
			editor
				.util(target.kind)
				.edgePoint(target, editor.pageToShape(target, from), editor.pageToShape(target, to))
		);
		const reach = vec.dist(from, edge);
		if (reach <= gap * 2) return edge;
		return vec.add(from, vec.mul(vec.sub(edge, from), (reach - gap) / reach));
	};

	const sideways = Math.abs(aimEnd.x - aimStart.x) >= Math.abs(aimEnd.y - aimStart.y);
	if (shape.props.elbow) {
		// A right-angled line leaves each shape straight out of its side, towards its corner.
		const [first, second] = elbowCorners(aimStart, aimEnd, sideways);
		return {
			start: editor.pageToShape(shape, startTarget ? stop(startTarget, first, aimStart) : aimStart),
			end: editor.pageToShape(shape, endTarget ? stop(endTarget, second, aimEnd) : aimEnd),
			sideways
		};
	}
	let start = startTarget ? stop(startTarget, aimEnd, aimStart) : aimStart;
	let end = endTarget ? stop(endTarget, aimStart, aimEnd) : aimEnd;
	// A bent line comes in from the side: each end stops where the curve meets its shape.
	const bend = shape.props.bend ?? 0;
	if (bend !== 0) {
		const control = controlPoint(start, end, bend);
		if (startTarget) start = stop(startTarget, control, aimStart);
		if (endTarget) end = stop(endTarget, control, aimEnd);
	}
	return {
		start: editor.pageToShape(shape, start),
		end: editor.pageToShape(shape, end),
		sideways
	};
}

/** Everything about how a line runs, in its own space: for drawing, hit testing and handles. */
export interface LineGeometry {
	start: Vec;
	end: Vec;
	/** Where a bent line is pulled towards; null for a straight one. */
	control: Vec | null;
	/** The middle of the line, on the curve: where its words and its bend handle sit. */
	middle: Vec;
	/** Points along the line (its two ends, if it is straight). */
	points: Vec[];
	/** The point each end is reached from: what an arrowhead there points away from. */
	from: { start: Vec; end: Vec };
	/** The line as an SVG path. */
	path: string;
}

export function lineGeometry(editor: Editor, shape: LineShape): LineGeometry {
	const { start, end, sideways } = lineEnds(editor, shape);
	if (shape.props.elbow) {
		const [first, second] = elbowCorners(start, end, sideways);
		const points = [start, first, second, end];
		return {
			start,
			end,
			control: null,
			middle: { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 },
			points,
			from: { start: first, end: second },
			path: `M${points.map(({ x, y }) => `${x},${y}`).join('L')}`
		};
	}
	const bend = shape.props.bend ?? 0;
	if (bend === 0)
		return {
			start,
			end,
			control: null,
			middle: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 },
			points: [start, end],
			from: { start: end, end: start },
			path: `M${start.x},${start.y}L${end.x},${end.y}`
		};
	const control = controlPoint(start, end, bend);
	const at = (t: number): Vec => ({
		x: (1 - t) ** 2 * start.x + 2 * (1 - t) * t * control.x + t ** 2 * end.x,
		y: (1 - t) ** 2 * start.y + 2 * (1 - t) * t * control.y + t ** 2 * end.y
	});
	return {
		start,
		end,
		control,
		middle: at(0.5),
		points: Array.from({ length: 17 }, (_, i) => at(i / 16)),
		from: { start: control, end: control },
		path: `M${start.x},${start.y}Q${control.x},${control.y} ${end.x},${end.y}`
	};
}
