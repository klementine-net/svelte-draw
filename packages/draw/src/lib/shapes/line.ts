/*
 * The line shape: a stroke from its origin to an end, straight, bent or in right angles, with
 * or without arrowheads, and the tools that draw it. Where it runs is worked out in
 * line-geometry.ts.
 */

import { box, vec, type Box, type Vec } from '../core/geometry.ts';
import { STROKE_WIDTH, type StyleKey } from '../core/records.ts';
import { ShapeUtil, type ResizeResult, type ShapeHandle } from '../core/shape-util.ts';
import { StateNode } from '../core/state-node.ts';
import type { ShapePatch } from '../core/editor.ts';
import type { PointerInfo } from '../core/events.ts';
import { lineEnds, lineGeometry, type LineProps, type LineShape } from './line-geometry.ts';

export {
	lineEnds,
	lineGeometry,
	type LineGeometry,
	type LineProps,
	type LineShape
} from './line-geometry.ts';

export class LineShapeUtil extends ShapeUtil<LineShape> {
	static override kind = 'line';
	override readonly styles: readonly StyleKey[] = ['color', 'size', 'look', 'font', 'opacity'];

	defaultProps(): LineProps {
		return { dx: 120, dy: 0, arrow: false, start: null, end: null };
	}

	bounds(shape: LineShape): Box {
		return box.around(lineGeometry(this.editor, shape).points);
	}

	/** Hit when the point is on the stroke itself, not merely in its box. */
	override hitTest(shape: LineShape, point: Vec, margin: number): boolean {
		const reach = STROKE_WIDTH[shape.style.size] / 2 + margin;
		const { points } = lineGeometry(this.editor, shape);
		for (let i = 1; i < points.length; i++)
			if (vec.distToSegment(point, points[i - 1], points[i]) <= reach) return true;
		return false;
	}

	override outline(shape: LineShape): string {
		return lineGeometry(this.editor, shape).path;
	}

	override canBind() {
		return false;
	}

	/** Words can be written on a line: they sit at its middle. */
	override canEdit() {
		return true;
	}

	/** The right-click menu switches the two arrowheads. */
	override toggles(shape: LineShape) {
		return [
			{ id: 'arrowStart', on: !!shape.props.arrowStart },
			{ id: 'arrowEnd', on: !!shape.props.arrow },
			{ id: 'elbow', on: !!shape.props.elbow }
		];
	}

	override toggle(shape: LineShape, id: string): ShapePatch | undefined {
		if (id === 'arrowStart') return { props: { arrowStart: !shape.props.arrowStart } };
		if (id === 'arrowEnd') return { props: { arrow: !shape.props.arrow } };
		if (id === 'elbow') return { props: { elbow: !shape.props.elbow } };
		return undefined;
	}

	/** A line is changed by its two ends and its middle (which bends it), not by a box. */
	override handles(shape: LineShape): ShapeHandle[] {
		const { start, end, middle } = lineGeometry(this.editor, shape);
		// A right-angled line has no bend to pull.
		if (shape.props.elbow)
			return [
				{ id: 'start', ...start },
				{ id: 'end', ...end }
			];
		// The end comes last: a line just begun has all three in one place, and the end is grabbed.
		return [
			{ id: 'start', ...start },
			{ id: 'bend', ...middle },
			{ id: 'end', ...end }
		];
	}

	/**
	 * The dragged end goes to the pointer, and attaches to a shape that is under it (Ctrl or
	 * Command held: stays free). Shift holds the line to steps of 15 degrees.
	 */
	override dragHandle(shape: LineShape, handle: string, point: Vec): ShapePatch {
		const { editor } = this;
		const ends = lineEnds(editor, shape);
		if (handle === 'bend') {
			// How far the pointer is to the side of the straight line between the ends.
			const p = editor.pageToShape(shape, point);
			const dx = ends.end.x - ends.start.x;
			const dy = ends.end.y - ends.start.y;
			const length = Math.hypot(dx, dy) || 1;
			const mx = (ends.start.x + ends.end.x) / 2;
			const my = (ends.start.y + ends.end.y) / 2;
			const bend = ((p.x - mx) * -dy + (p.y - my) * dx) / length;
			// Close to straight is straight.
			return { props: { bend: Math.abs(bend) < 6 / editor.camera.peek().z ? 0 : bend } };
		}
		const which = handle === 'start' ? 'start' : 'end';
		const other = which === 'start' ? 'end' : 'start';
		// The end that stays: where it shows now.
		const fixed = editor.shapeToPage(shape, ends[other]);

		let moved = point;
		if (editor.inputs.shift) {
			const length = vec.dist(fixed, point);
			const step = Math.PI / 12;
			const angle = Math.round(Math.atan2(point.y - fixed.y, point.x - fixed.x) / step) * step;
			moved = { x: fixed.x + Math.cos(angle) * length, y: fixed.y + Math.sin(angle) * length };
		}
		const target = editor.inputs.meta
			? undefined
			: editor.getBindTargetAt(moved, [shape.id, shape.props[other]]);
		// The shape the end would attach to shows its outline.
		editor.hovered.set(target?.id ?? null);

		const placed = this.#between(
			shape,
			which === 'start' ? moved : fixed,
			which === 'start' ? fixed : moved
		);
		return { ...placed, props: { ...placed.props, [which]: target?.id ?? null } };
	}

	/** The line's place and reach when it runs between two points on the page. */
	#between(shape: LineShape, from: Vec, to: Vec) {
		const a = this.editor.pageToParent(shape, from);
		const b = this.editor.pageToParent(shape, to);
		const d = vec.rotate(vec.sub(b, a), -(shape.rotation ?? 0));
		return { x: a.x, y: a.y, props: { dx: d.x, dy: d.y } };
	}

	/** A line does not turn around its origin: its two ends move around the pivot. */
	override rotate(shape: LineShape, angle: number, pivot: Vec): ShapePatch {
		const ends = lineEnds(this.editor, shape);
		const turned = (end: Vec) =>
			vec.add(pivot, vec.rotate(vec.sub(this.editor.shapeToPage(shape, end), pivot), angle));
		return this.#between(shape, turned(ends.start), turned(ends.end));
	}

	override ties(shape: LineShape): string[] {
		return [shape.props.start, shape.props.end].filter((id) => typeof id === 'string');
	}

	override retie(shape: LineShape, map: (id: string) => string | null): ShapePatch | undefined {
		const start = shape.props.start ? map(shape.props.start) : null;
		const end = shape.props.end ? map(shape.props.end) : null;
		if (start === (shape.props.start ?? null) && end === (shape.props.end ?? null))
			return undefined;
		// Kept as it shows now: an end that lets go stays where it was drawn.
		const ends = lineEnds(this.editor, shape);
		const turn = shape.rotation ?? 0;
		const origin = vec.add(vec.rotate(ends.start, turn), shape);
		return {
			x: origin.x,
			y: origin.y,
			props: { dx: ends.end.x - ends.start.x, dy: ends.end.y - ends.start.y, start, end }
		};
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
				dy: (startsTop ? target.y + target.h : target.y) - y,
				// Mirrored once, a bend goes to the other side.
				bend: flip.x !== flip.y ? -(shape.props.bend ?? 0) : shape.props.bend
			}
		};
	}
}

class Idle extends StateNode {
	static override id = 'idle';

	override onEnter() {
		this.editor.cursor.set('crosshair');
	}

	override onExit() {
		this.editor.hovered.set(null);
	}

	/** The shape a new line would start on shows its outline. */
	override onPointerMove() {
		const { editor } = this;
		editor.hovered.set(editor.getBindTargetAt(editor.inputs.page)?.id ?? null);
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

	/**
	 * A drag begins the line where the press was (attached, if a shape is there) and hands its
	 * end to the select tool: drawing a new line and dragging an old one's end are the same code.
	 */
	override onPointerMove() {
		const { editor } = this;
		if (!editor.inputs.isDragging) return;
		const from = editor.inputs.originPage;
		const target = editor.inputs.meta ? undefined : editor.getBindTargetAt(from);
		editor.history.mark();
		const shape = editor.createShape({
			kind: 'line',
			x: from.x,
			y: from.y,
			props: { dx: 0, dy: 0, arrow: (this.parent as LineTool).arrow, start: target?.id ?? null }
		});
		editor.select([shape.id]);
		editor.setTool('select.dragging_handle', { handle: 'end', creating: true });
	}

	// A click without a drag makes nothing: a line needs two ends.
	override onPointerUp() {
		this.parent!.transition('idle');
	}

	override onCancel() {
		this.parent!.transition('idle');
	}
}

export class LineTool extends StateNode {
	static override id = 'line';
	static override initial = 'idle';
	static override children = () => [Idle, Pointing];

	/** Whether the lines this tool makes have an arrowhead. */
	arrow = false;
}

export class ArrowTool extends LineTool {
	static override id = 'arrow';
	override arrow = true;
}
