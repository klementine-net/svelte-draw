/*
 * The outlines of the geo shape's kinds. Each kind is a closed outline in a w × h box, given
 * as points: the corners of a shape with corners, or many points along a curve (`SMOOTH`).
 * Drawing, hit testing and where an attached arrow stops all work from these points, so a new
 * kind is one entry here.
 */

import type { Vec } from '../core/geometry.ts';

/** The kinds, simplest first: round and square, corners by their count, the free forms, arrows clockwise, boxes with a mark. */
export const GEO_KINDS = [
	'rectangle',
	'ellipse',
	'oval',
	'triangle',
	'diamond',
	'pentagon',
	'hexagon',
	'octagon',
	'star',
	'heart',
	'cloud',
	'trapezoid',
	'parallelogram',
	'arrow-up',
	'arrow-right',
	'arrow-down',
	'arrow-left',
	'cross-box',
	'tick-box'
] as const;
export type GeoKind = (typeof GEO_KINDS)[number];

/** The kinds whose outline is a curve: drawn smooth through their points. */
export const SMOOTH: ReadonlySet<GeoKind> = new Set(['oval', 'heart', 'cloud']);

type Unit = [number, number][];

/** Stretches points to fill the unit square exactly. */
function fit(points: Unit): Unit {
	const xs = points.map(([x]) => x);
	const ys = points.map(([, y]) => y);
	const minX = Math.min(...xs);
	const minY = Math.min(...ys);
	const w = Math.max(...xs) - minX || 1;
	const h = Math.max(...ys) - minY || 1;
	return points.map(([x, y]) => [(x - minX) / w, (y - minY) / h]);
}

/** `n` corners evenly around a circle, the first at `start` (radians). */
function regular(n: number, start: number, inner?: number): Unit {
	const count = inner ? n * 2 : n;
	return fit(
		Array.from({ length: count }, (_, i) => {
			const angle = start + (i * Math.PI * 2) / count;
			const radius = inner && i % 2 === 1 ? inner : 1;
			return [Math.cos(angle) * radius, Math.sin(angle) * radius];
		})
	);
}

function heart(): Unit {
	return fit(
		Array.from({ length: 48 }, (_, i) => {
			const t = (i / 48) * Math.PI * 2;
			return [
				16 * Math.sin(t) ** 3,
				-(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))
			];
		})
	);
}

/** Puffs around an ellipse: each a half circle between two points on it, bulging outwards. */
function cloud(): Unit {
	const puffs = 8;
	const anchors = Array.from({ length: puffs }, (_, i): [number, number] => {
		const angle = -Math.PI / 2 + ((i + 0.5) * Math.PI * 2) / puffs;
		return [Math.cos(angle) * 1.25, Math.sin(angle) * 0.85];
	});
	const points: Unit = [];
	for (let i = 0; i < puffs; i++) {
		const a = anchors[i];
		const b = anchors[(i + 1) % puffs];
		const mx = (a[0] + b[0]) / 2;
		const my = (a[1] + b[1]) / 2;
		const radius = Math.hypot(b[0] - a[0], b[1] - a[1]) / 2;
		const from = Math.atan2(a[1] - my, a[0] - mx);
		// Half a turn from a to b, the way that leads away from the middle.
		const outward = Math.atan2(my, mx);
		const turn = Math.sin(outward - from) >= 0 ? 1 : -1;
		for (let step = 0; step < 6; step++) {
			const angle = from + (turn * Math.PI * step) / 6;
			points.push([mx + Math.cos(angle) * radius, my + Math.sin(angle) * radius]);
		}
	}
	return fit(points);
}

const arrowRight: Unit = [
	[0, 0.25],
	[0.6, 0.25],
	[0.6, 0],
	[1, 0.5],
	[0.6, 1],
	[0.6, 0.75],
	[0, 0.75]
];
const square: Unit = [
	[0, 0],
	[1, 0],
	[1, 1],
	[0, 1]
];

const UNITS: Partial<Record<GeoKind, () => Unit>> = {
	rectangle: () => square,
	'cross-box': () => square,
	'tick-box': () => square,
	triangle: () => [
		[0.5, 0],
		[1, 1],
		[0, 1]
	],
	diamond: () => [
		[0.5, 0],
		[1, 0.5],
		[0.5, 1],
		[0, 0.5]
	],
	pentagon: () => regular(5, -Math.PI / 2),
	hexagon: () => regular(6, 0),
	octagon: () => regular(8, -Math.PI / 2 + Math.PI / 8),
	star: () => regular(5, -Math.PI / 2, 0.5),
	trapezoid: () => [
		[0.2, 0],
		[0.8, 0],
		[1, 1],
		[0, 1]
	],
	parallelogram: () => [
		[0.25, 0],
		[1, 0],
		[0.75, 1],
		[0, 1]
	],
	heart,
	cloud,
	'arrow-right': () => arrowRight,
	'arrow-left': () => arrowRight.map(([x, y]) => [1 - x, y]),
	'arrow-down': () => arrowRight.map(([x, y]) => [y, x]),
	'arrow-up': () => arrowRight.map(([x, y]) => [y, 1 - x])
};
const cache = new Map<GeoKind, Unit>();

/** A box with its short sides rounded all the way: two half circles and what joins them. */
function oval(w: number, h: number): Vec[] {
	const r = Math.min(w, h) / 2;
	const points: Vec[] = [];
	const arc = (cx: number, cy: number, from: number) => {
		for (let i = 0; i <= 12; i++) {
			const angle = from + (Math.PI * i) / 12;
			points.push({ x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r });
		}
	};
	if (w >= h) {
		arc(w - r, r, -Math.PI / 2);
		arc(r, r, Math.PI / 2);
	} else {
		arc(r, h - r, 0);
		arc(r, r, Math.PI);
	}
	return points;
}

/** The outline of `geo` in a w × h box. Not for `ellipse`, which is exact and has no points. */
export function geoPoints(geo: GeoKind, w: number, h: number): Vec[] {
	if (geo === 'oval') return oval(w, h);
	let unit = cache.get(geo);
	if (!unit) {
		unit = (UNITS[geo] ?? UNITS.rectangle!)();
		cache.set(geo, unit);
	}
	return unit.map(([x, y]) => ({ x: x * w, y: y * h }));
}

/** The strokes inside the outline: the cross of a cross-box, the tick of a tick-box. */
export function geoMarks(geo: GeoKind, w: number, h: number): Vec[][] {
	const at = (points: Unit) => points.map(([x, y]) => ({ x: x * w, y: y * h }));
	if (geo === 'cross-box')
		return [
			at([
				[0, 0],
				[1, 1]
			]),
			at([
				[1, 0],
				[0, 1]
			])
		];
	if (geo === 'tick-box')
		return [
			at([
				[0.25, 0.52],
				[0.43, 0.7],
				[0.75, 0.32]
			])
		];
	return [];
}
