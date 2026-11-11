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
	translate: (b: Box, d: Vec): Box => ({ ...b, x: b.x + d.x, y: b.y + d.y }),
	center: (b: Box): Vec => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 })
};
