/* Points and boxes. Plain objects, never mutated. */

export interface Vec {
	x: number;
	y: number;
}

export interface Box {
	x: number;
	y: number;
	w: number;
	h: number;
}

export const vec = {
	add: (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y }),
	sub: (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y }),
	mul: (a: Vec, s: number): Vec => ({ x: a.x * s, y: a.y * s }),
	dist: (a: Vec, b: Vec): number => Math.hypot(a.x - b.x, a.y - b.y),
	/** `p` turned by `angle` (radians, clockwise on screen) around the origin. */
	rotate(p: Vec, angle: number): Vec {
		if (angle === 0) return p;
		const cos = Math.cos(angle);
		const sin = Math.sin(angle);
		return { x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos };
	},
	/** Distance from `p` to the segment a–b. */
	distToSegment(p: Vec, a: Vec, b: Vec): number {
		const dx = b.x - a.x;
		const dy = b.y - a.y;
		const len = dx * dx + dy * dy;
		const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len));
		return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
	}
};

export const box = {
	/** The box spanned by two points, whatever their order. */
	fromPoints(a: Vec, b: Vec): Box {
		return {
			x: Math.min(a.x, b.x),
			y: Math.min(a.y, b.y),
			w: Math.abs(a.x - b.x),
			h: Math.abs(a.y - b.y)
		};
	},
	/** The smallest box around the points. */
	around(points: Vec[]): Box {
		let minX = Infinity;
		let minY = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;
		for (const p of points) {
			minX = Math.min(minX, p.x);
			minY = Math.min(minY, p.y);
			maxX = Math.max(maxX, p.x);
			maxY = Math.max(maxY, p.y);
		}
		return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
	},
	/** The four corners, clockwise from the top left. */
	corners: (b: Box): Vec[] => [
		{ x: b.x, y: b.y },
		{ x: b.x + b.w, y: b.y },
		{ x: b.x + b.w, y: b.y + b.h },
		{ x: b.x, y: b.y + b.h }
	],
	/** The smallest box around all `boxes`; undefined for none. */
	union(boxes: Box[]): Box | undefined {
		if (boxes.length === 0) return undefined;
		let minX = Infinity;
		let minY = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;
		for (const b of boxes) {
			minX = Math.min(minX, b.x);
			minY = Math.min(minY, b.y);
			maxX = Math.max(maxX, b.x + b.w);
			maxY = Math.max(maxY, b.y + b.h);
		}
		return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
	},
	contains: (b: Box, p: Vec, margin = 0): boolean =>
		p.x >= b.x - margin &&
		p.x <= b.x + b.w + margin &&
		p.y >= b.y - margin &&
		p.y <= b.y + b.h + margin,
	intersects: (a: Box, b: Box): boolean =>
		a.x <= b.x + b.w && a.x + a.w >= b.x && a.y <= b.y + b.h && a.y + a.h >= b.y,
	/**
	 * Where the segment from → to first meets the box's edge. `to` when it never does, or when
	 * it starts inside the box.
	 */
	entry(b: Box, from: Vec, to: Vec): Vec {
		if (box.contains(b, from)) return to;
		const dx = to.x - from.x;
		const dy = to.y - from.y;
		let enter = 0;
		let leave = 1;
		for (const [d, low, high, p] of [
			[dx, b.x, b.x + b.w, from.x],
			[dy, b.y, b.y + b.h, from.y]
		]) {
			if (d === 0) {
				if (p < low || p > high) return to;
				continue;
			}
			const one = (low - p) / d;
			const other = (high - p) / d;
			enter = Math.max(enter, Math.min(one, other));
			leave = Math.min(leave, Math.max(one, other));
		}
		return enter <= leave ? { x: from.x + dx * enter, y: from.y + dy * enter } : to;
	},
	translate: (b: Box, d: Vec): Box => ({ ...b, x: b.x + d.x, y: b.y + d.y }),
	center: (b: Box): Vec => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 })
};

/** A closed outline given as its corner points. */
export const polygon = {
	/** Whether `p` is inside the outline. */
	contains(points: Vec[], p: Vec): boolean {
		let inside = false;
		for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
			const a = points[i];
			const b = points[j];
			if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x)
				inside = !inside;
		}
		return inside;
	},
	/** The distance from `p` to the outline itself. */
	distance(points: Vec[], p: Vec): number {
		let nearest = Infinity;
		for (let i = 0; i < points.length; i++)
			nearest = Math.min(nearest, vec.distToSegment(p, points[i], points[(i + 1) % points.length]));
		return nearest;
	},
	/**
	 * Where the segment from → to first crosses the outline. `to` when it never does, or when
	 * it starts inside.
	 */
	entry(points: Vec[], from: Vec, to: Vec): Vec {
		if (polygon.contains(points, from)) return to;
		const dx = to.x - from.x;
		const dy = to.y - from.y;
		let first = Infinity;
		for (let i = 0; i < points.length; i++) {
			const a = points[i];
			const b = points[(i + 1) % points.length];
			const ex = b.x - a.x;
			const ey = b.y - a.y;
			const cross = dx * ey - dy * ex;
			if (cross === 0) continue;
			const t = ((a.x - from.x) * ey - (a.y - from.y) * ex) / cross;
			const u = ((a.x - from.x) * dy - (a.y - from.y) * dx) / cross;
			if (t >= 0 && t <= 1 && u >= 0 && u <= 1) first = Math.min(first, t);
		}
		return first === Infinity ? to : { x: from.x + dx * first, y: from.y + dy * first };
	}
};
