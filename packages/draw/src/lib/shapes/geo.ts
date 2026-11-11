/*
 * The geo shape: a closed outline in a box (a rectangle, an ellipse, a star, …) that can
 * carry a few words, and the tools that drag one out. The kinds live in geo-paths.ts.
 */

import { polygon, type Box, type Vec } from '../core/geometry.ts';
import { STROKE_WIDTH, type ShapeRecord, type StyleKey } from '../core/records.ts';
import { ShapeUtil, type ResizeResult } from '../core/shape-util.ts';
import type { StateNodeConstructor } from '../core/state-node.ts';
import { BoxTool } from '../tools/box-tool.ts';
import { outlineToPath } from './sketch.ts';
import { GEO_KINDS, geoPoints, SMOOTH, type GeoKind } from './geo-paths.ts';

export type GeoProps = {
	geo: GeoKind;
	w: number;
	h: number;
	/** The words written in the shape. */
	text?: string;
};

export type GeoShape = ShapeRecord<'geo', GeoProps>;

export class GeoShapeUtil extends ShapeUtil<GeoShape> {
	static override kind = 'geo';
	override readonly styles: readonly StyleKey[] = [
		'color',
		'fill',
		'size',
		'look',
		'font',
		'align',
		'valign',
		'opacity'
	];

	defaultProps(): GeoProps {
		return { geo: 'rectangle', w: 160, h: 120, text: '' };
	}

	bounds(shape: GeoShape): Box {
		return { x: 0, y: 0, w: shape.props.w, h: shape.props.h };
	}

	override canEdit() {
		return true;
	}

	/** A filled shape is hit anywhere inside; a hollow one only on its line. */
	override hitTest(shape: GeoShape, point: Vec, margin: number): boolean {
		const { geo, w, h } = shape.props;
		const filled = shape.style.fill !== 'none';
		const line = STROKE_WIDTH[shape.style.size] / 2 + margin;

		if (geo === 'ellipse') {
			const rx = Math.max(w / 2, 0.5);
			const ry = Math.max(h / 2, 0.5);
			// Distance from the centre, measured in radii: 1 is on the edge.
			const r = Math.hypot((point.x - rx) / rx, (point.y - ry) / ry);
			const slack = line / Math.min(rx, ry);
			return filled ? r <= 1 + slack : Math.abs(r - 1) <= slack;
		}

		const points = geoPoints(geo, w, h);
		if (polygon.distance(points, point) <= line) return true;
		return filled && polygon.contains(points, point);
	}

	/** An attached arrow stops at the outline itself, not at the box around it. */
	override edgePoint(shape: GeoShape, from: Vec, to: Vec): Vec {
		const { geo, w, h } = shape.props;
		if (geo !== 'ellipse') return polygon.entry(geoPoints(geo, w, h), from, to);
		const rx = w / 2;
		const ry = h / 2;
		if (rx <= 0 || ry <= 0) return to;
		// In a space where the ellipse is the unit circle: solve |from + t·d| = 1 for the first t.
		const fx = (from.x - rx) / rx;
		const fy = (from.y - ry) / ry;
		const dx = (to.x - from.x) / rx;
		const dy = (to.y - from.y) / ry;
		const a = dx * dx + dy * dy;
		const b = 2 * (fx * dx + fy * dy);
		const c = fx * fx + fy * fy - 1;
		const root = b * b - 4 * a * c;
		if (c <= 0 || a === 0 || root < 0) return to;
		const t = (-b - Math.sqrt(root)) / (2 * a);
		if (t < 0 || t > 1) return to;
		return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
	}

	override outline(shape: GeoShape): string {
		return geoPath(shape.props.geo, shape.props.w, shape.props.h);
	}

	resize(shape: GeoShape, target: Box): ResizeResult<GeoShape> {
		return {
			x: target.x,
			y: target.y,
			props: { ...shape.props, w: Math.max(1, target.w), h: Math.max(1, target.h) }
		};
	}
}

/** The exact outline of a kind as an SVG path. */
export function geoPath(geo: GeoKind, w: number, h: number): string {
	if (geo === 'ellipse') {
		const rx = w / 2;
		const ry = h / 2;
		return `M0,${ry}a${rx},${ry} 0 1,0 ${w},0a${rx},${ry} 0 1,0 ${-w},0z`;
	}
	const points = geoPoints(geo, w, h);
	if (SMOOTH.has(geo)) return outlineToPath(points.map(({ x, y }) => [x, y]));
	return `M${points.map(({ x, y }) => `${x},${y}`).join('L')}Z`;
}

/** A tool that drags out one kind of geo shape. The tool's id is the kind's name. */
export function geoTool(geo: GeoKind): StateNodeConstructor {
	return class extends BoxTool {
		static override id: string = geo;
		shape = { kind: 'geo', props: { geo } };
	};
}

export class RectangleTool extends BoxTool {
	static override id = 'rectangle';
	shape = { kind: 'geo', props: { geo: 'rectangle' } };
}

export class EllipseTool extends BoxTool {
	static override id = 'ellipse';
	shape = { kind: 'geo', props: { geo: 'ellipse' } };
}

/** One tool for each of the other kinds. */
export const GEO_TOOLS: StateNodeConstructor[] = GEO_KINDS.filter(
	(geo) => geo !== 'rectangle' && geo !== 'ellipse'
).map(geoTool);
