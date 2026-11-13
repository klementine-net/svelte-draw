/*
 * Snapping: a moved box or point catches on other shapes' edges and middles, or on the grid.
 * Each function is one of the editor's methods: the editor calls it with itself, and the
 * method's documentation is on the `Editor` class.
 */

import { box, type Box, type Vec } from '../geometry.ts';
import type { Editor, SnapLine } from '../editor.ts';
import { SNAP_DISTANCE, GRID_SIZE } from './constants.ts';

/** The places other shapes offer to snap to: their edges and middles, on each axis. */
function snapStops(
	editor: Editor,
	exclude: ReadonlySet<string>
): { xs: [number, Box][]; ys: [number, Box][] } {
	const { w, h } = editor.viewport.peek();
	const a = editor.screenToPage({ x: 0, y: 0 });
	const b = editor.screenToPage({ x: w, y: h });
	const view = box.fromPoints(a, b);
	const xs: [number, Box][] = [];
	const ys: [number, Box][] = [];
	const skipped = new Set(exclude);
	for (const shape of editor.getShapes()) {
		// What is inside a moving shape moves too.
		if (skipped.has(shape.id) || skipped.has(shape.parentId)) {
			skipped.add(shape.id);
			continue;
		}
		const util = editor.util(shape.kind);
		if (util.group || util.ties(shape).length > 0) continue;
		const bounds = editor.getShapePageBounds(shape);
		if (!box.intersects(view, bounds)) continue;
		for (const x of [bounds.x, bounds.x + bounds.w / 2, bounds.x + bounds.w]) xs.push([x, bounds]);
		for (const y of [bounds.y, bounds.y + bounds.h / 2, bounds.y + bounds.h]) ys.push([y, bounds]);
	}
	return { xs, ys };
}

export function snapBox(editor: Editor, moving: Box, exclude: ReadonlySet<string>): Vec {
	const reach = SNAP_DISTANCE / editor.camera.peek().z;
	const stops = snapStops(editor, exclude);
	const nearest = (values: number[], candidates: [number, Box][]) => {
		let best: { d: number; at: number; other: Box } | undefined;
		for (const value of values)
			for (const [at, other] of candidates) {
				const d = at - value;
				if (Math.abs(d) <= reach && (!best || Math.abs(d) < Math.abs(best.d)))
					best = { d, at, other };
			}
		return best;
	};
	const x = nearest([moving.x, moving.x + moving.w / 2, moving.x + moving.w], stops.xs);
	const y = nearest([moving.y, moving.y + moving.h / 2, moving.y + moving.h], stops.ys);
	// Where no shape is near, the grid catches the top left corner, if it is switched on.
	const onGrid = (value: number) => Math.round(value / GRID_SIZE) * GRID_SIZE - value;
	const snapToGrid = editor.grid.peek().snap && moving.w + moving.h > 0;
	const gridX = !x && snapToGrid ? onGrid(moving.x) : 0;
	const gridY = !y && snapToGrid ? onGrid(moving.y) : 0;
	const moved = box.translate(moving, { x: x?.d ?? 0, y: y?.d ?? 0 });
	const lines: SnapLine[] = [];
	if (x) {
		const span = box.union([moved, x.other])!;
		lines.push({ from: { x: x.at, y: span.y }, to: { x: x.at, y: span.y + span.h } });
	}
	if (y) {
		const span = box.union([moved, y.other])!;
		lines.push({ from: { x: span.x, y: y.at }, to: { x: span.x + span.w, y: y.at } });
	}
	editor.snapLines.set(lines);
	return { x: x?.d ?? gridX, y: y?.d ?? gridY };
}

export function snapPoint(
	editor: Editor,
	point: Vec,
	exclude: ReadonlySet<string>,
	axes: { x: boolean; y: boolean }
): Vec {
	const d = editor.snapBox({ x: point.x, y: point.y, w: 0, h: 0 }, exclude);
	const lines = editor.snapLines.peek();
	// A guide for an axis the point does not move on would be a lie.
	editor.snapLines.set(lines.filter((line) => (line.from.x === line.to.x ? axes.x : axes.y)));
	return { x: point.x + (axes.x ? d.x : 0), y: point.y + (axes.y ? d.y : 0) };
}
