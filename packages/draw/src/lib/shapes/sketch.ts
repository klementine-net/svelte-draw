/*
 * The pen-on-paper look. A stroke is not a line with a width: it is the filled outline of where
 * a pen went, wider where it pressed. `perfect-freehand` turns points into that outline; this
 * file feeds it (a real stroke, or the walked edge of a rectangle or ellipse with a little
 * unsteadiness) and turns its answer into an SVG path.
 *
 * Everything here is pure and seeded by the shape's id, so a shape looks the same on every
 * screen and on every redraw.
 */

import { getStroke } from 'perfect-freehand';

export type InkPoint = [x: number, y: number, pressure: number];

/** A repeatable random source (0–1) from a string. */
export function seededRandom(seed: string): () => number {
	let h = 2166136261;
	for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
	return () => {
		h += 0x6d2b79f5;
		let t = h;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const round = (n: number) => Math.round(n * 100) / 100;

/** A closed, smooth SVG path through the outline points (curves through the midpoints). */
export function outlineToPath(points: number[][]): string {
	if (points.length < 3) return '';
	const mid = (a: number[], b: number[]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
	const start = mid(points[points.length - 1], points[0]);
	let d = `M${round(start[0])},${round(start[1])}`;
	for (let i = 0; i < points.length; i++) {
		const p = points[i];
		const m = mid(p, points[(i + 1) % points.length]);
		d += `Q${round(p[0])},${round(p[1])} ${round(m[0])},${round(m[1])}`;
	}
	return d + 'Z';
}

/** The path of a freehand stroke. `pen` uses the points' real pressure; otherwise speed fakes it. */
export function inkPath(points: InkPoint[], size: number, pen: boolean, done: boolean): string {
	return outlineToPath(
		getStroke(points, {
			size,
			thinning: pen ? 0.6 : 0.5,
			smoothing: 0.5,
			streamline: 0.5,
			simulatePressure: !pen,
			last: done
		})
	);
}

/** The path of a shape's edge drawn as one steady pen stroke. */
function edgePath(points: InkPoint[], size: number): string {
	return outlineToPath(
		getStroke(points, {
			size: size * 1.1,
			thinning: 0.35,
			smoothing: 0.6,
			streamline: 0.3,
			simulatePressure: false,
			last: true
		})
	);
}

/** A rectangle's edge, walked like a hand would: corners a little off, sides a little bowed. */
export function sketchRectangle(w: number, h: number, size: number, seed: string): string {
	const random = seededRandom(seed);
	const wobble = Math.min(size * 0.7, 3, Math.min(w, h) * 0.08);
	const jitter = () => (random() - 0.5) * 2 * wobble;
	const corners = [
		[0, 0],
		[w, 0],
		[w, h],
		[0, h]
	].map(([x, y]) => [x + jitter(), y + jitter()]);
	const radius = Math.min(size * 1.5, w / 4, h / 4);

	const points: InkPoint[] = [];
	const pressure = () => 0.5 + (random() - 0.5) * 0.25;
	// Four sides, then a little of the first again, so the stroke closes over its own start.
	for (let side = 0; side < 5; side++) {
		const a = corners[side % 4];
		const b = corners[(side + 1) % 4];
		const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
		if (length === 0) continue;
		const ux = (b[0] - a[0]) / length;
		const uy = (b[1] - a[1]) / length;
		const bow = jitter() * 0.6;
		// Every side starts and ends a corner's radius in; the last pass only overlaps the start.
		const from = Math.min(radius, length / 2);
		const to = side === 4 ? from + Math.min(length * 0.2, size * 4) : length - from;
		const steps = Math.max(2, Math.round((to - from) / 14));
		for (let i = 0; i <= steps; i++) {
			const t = from + ((to - from) * i) / steps;
			// The bow is strongest mid-side and gone at the corners.
			const lift = Math.sin((t / length) * Math.PI) * bow;
			points.push([a[0] + ux * t - uy * lift, a[1] + uy * t + ux * lift, pressure()]);
		}
	}
	return edgePath(points, size);
}

/** An ellipse's edge in one sweep that overshoots its start a little. */
export function sketchEllipse(w: number, h: number, size: number, seed: string): string {
	const random = seededRandom(seed);
	const rx = w / 2;
	const ry = h / 2;
	const wobble = Math.min(0.03, (size * 0.6) / Math.max(1, Math.min(rx, ry)));
	const phase = random() * Math.PI * 2;
	const start = -Math.PI / 2 - 0.3 + (random() - 0.5) * 0.4;
	const sweep = Math.PI * 2 + 0.2;
	const steps = Math.max(24, Math.round((Math.PI * (rx + ry)) / 12));

	const points: InkPoint[] = [];
	for (let i = 0; i <= steps; i++) {
		const angle = start + (sweep * i) / steps;
		// Slowly varying radius, and a slight drift so the end does not land on the start.
		const scale = 1 + wobble * Math.sin(angle * 2 + phase) + (wobble * 0.25 * i) / steps;
		points.push([
			rx + Math.cos(angle) * rx * scale,
			ry + Math.sin(angle) * ry * scale,
			0.5 + (random() - 0.5) * 0.25
		]);
	}
	return edgePath(points, size);
}

/**
 * A straight line as a hand would draw it: a slight bow, and for an arrow a head of two short
 * strokes at the end. Returns the path of all its strokes.
 */
export function sketchLine(
	dx: number,
	dy: number,
	size: number,
	seed: string,
	arrow: boolean
): string {
	const random = seededRandom(seed);
	const length = Math.hypot(dx, dy);
	if (length === 0) return '';
	const ux = dx / length;
	const uy = dy / length;
	const bow = (random() - 0.5) * 2 * Math.min(size * 0.8, length * 0.02);
	const steps = Math.max(2, Math.round(length / 14));
	const shaft: InkPoint[] = [];
	for (let i = 0; i <= steps; i++) {
		const t = (length * i) / steps;
		const lift = Math.sin((t / length) * Math.PI) * bow;
		shaft.push([ux * t - uy * lift, uy * t + ux * lift, 0.5 + (random() - 0.5) * 0.25]);
	}
	let d = edgePath(shaft, size);
	if (arrow) {
		for (const [from, to] of arrowHead(dx, dy, size))
			d += edgePath(
				[
					[from.x, from.y, 0.5],
					[(from.x + to.x) / 2, (from.y + to.y) / 2, 0.55],
					[to.x, to.y, 0.5]
				],
				size
			);
	}
	return d;
}

/** The two barbs of an arrowhead at the end of a line: each from its outer end to the tip. */
export function arrowHead(
	dx: number,
	dy: number,
	size: number
): [{ x: number; y: number }, { x: number; y: number }][] {
	const length = Math.hypot(dx, dy);
	if (length === 0) return [];
	const barb = Math.min(size * 3 + 8, length * 0.45);
	const angle = Math.atan2(dy, dx);
	const spread = 0.48;
	return [-spread, spread].map((turn) => [
		{
			x: dx - Math.cos(angle + turn) * barb,
			y: dy - Math.sin(angle + turn) * barb
		},
		{ x: dx, y: dy }
	]);
}
