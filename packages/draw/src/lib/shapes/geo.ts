/* The geo shape: a rectangle or an ellipse in a box, and the two tools that drag one out. */

import { box, type Box, type Vec } from '../core/geometry.ts';
import { STROKE_WIDTH, type ShapeRecord } from '../core/records.ts';
import { ShapeUtil, type ResizeResult } from '../core/shape-util.ts';
import { BoxTool } from '../tools/box-tool.ts';

export type GeoProps = {
	geo: 'rectangle' | 'ellipse';
	w: number;
	h: number;
};

export type GeoShape = ShapeRecord<'geo', GeoProps>;

export class GeoShapeUtil extends ShapeUtil<GeoShape> {
	static override kind = 'geo';

	defaultProps(): GeoProps {
		return { geo: 'rectangle', w: 160, h: 120 };
	}

	bounds(shape: GeoShape): Box {
		return { x: 0, y: 0, w: shape.props.w, h: shape.props.h };
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

		const bounds = this.bounds(shape);
		if (!box.contains(bounds, point, line)) return false;
		if (filled) return true;
		const inner = { x: line, y: line, w: w - line * 2, h: h - line * 2 };
		return inner.w <= 0 || inner.h <= 0 || !box.contains(inner, point);
	}

	override outline(shape: GeoShape): string {
		const { geo, w, h } = shape.props;
		if (geo === 'ellipse') {
			const rx = w / 2;
			const ry = h / 2;
			return `M0,${ry}a${rx},${ry} 0 1,0 ${w},0a${rx},${ry} 0 1,0 ${-w},0z`;
		}
		return `M0,0h${w}v${h}h${-w}z`;
	}

	resize(shape: GeoShape, target: Box): ResizeResult<GeoShape> {
		return {
			x: target.x,
			y: target.y,
			props: { ...shape.props, w: Math.max(1, target.w), h: Math.max(1, target.h) }
		};
	}
}

export class RectangleTool extends BoxTool {
	static override id = 'rectangle';
	shape = { kind: 'geo', props: { geo: 'rectangle' } };
}

export class EllipseTool extends BoxTool {
	static override id = 'ellipse';
	shape = { kind: 'geo', props: { geo: 'ellipse' } };
}
