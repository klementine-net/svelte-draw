/*
 * What is done to the selection as a whole: order, nudge, align, space, flip, lock, style, delete.
 * Each function is one of the editor's methods: the editor calls it with itself, and the
 * method's documentation is on the `Editor` class.
 */

import { box, vec, type Vec } from '../geometry.ts';
import { indexBetween } from '../indexing.ts';
import type { ShapeRecord, ShapeStyle } from '../records.ts';
import type { Editor, AlignEdge } from '../editor.ts';

export function restack(
	editor: Editor,
	ids: readonly string[],
	where: 'front' | 'back' | 'forward' | 'backward'
) {
	if (editor.readOnly.peek()) return;
	const moving = editor.getShapes().filter((shape) => ids.includes(shape.id));
	const up = where === 'front' || where === 'forward';
	if (up === (where === 'forward')) moving.reverse();
	editor.history.mark();
	editor.store.transact(() => {
		for (const shape of moving) {
			const siblings = editor.getChildren(shape.parentId);
			const others = siblings.filter((s) => s.id !== shape.id);
			if (others.length === 0) continue;
			let index: string;
			if (where === 'front') index = indexBetween(others[others.length - 1].index);
			else if (where === 'back') index = indexBetween(undefined, others[0].index);
			else {
				// Past the nearest sibling in that direction that stays where it is.
				const at = siblings.findIndex((s) => s.id === shape.id);
				const step = up ? 1 : -1;
				let next = at + step;
				while (siblings[next] && ids.includes(siblings[next].id)) next += step;
				if (!siblings[next]) continue;
				const beyond = siblings[next + step];
				index = up
					? indexBetween(siblings[next].index, beyond?.index)
					: indexBetween(beyond?.index, siblings[next].index);
			}
			editor.updateShape(shape.id, { index });
		}
	});
}

export function deleteSelection(editor: Editor) {
	if (editor.readOnly.peek()) return;
	const ids = editor
		.getSelectedShapes()
		.filter((shape) => !editor.isLocked(shape))
		.map((shape) => shape.id);
	if (ids.length === 0) return;
	editor.history.mark();
	editor.deleteShapes(ids);
}

export function toggleSelection(editor: Editor, id: string) {
	if (editor.readOnly.peek()) return;
	const patches = editor.getSelectedShapes().flatMap((shape) => {
		if (editor.isLocked(shape)) return [];
		const patch = editor.util(shape.kind).toggle(shape, id);
		return patch ? [{ id: shape.id, ...patch }] : [];
	});
	if (patches.length === 0) return;
	editor.history.mark();
	editor.updateShapes(patches);
	editor.history.mark();
}

/** The change that moves `shape` by `d`, a distance on the page. */
function moved(editor: Editor, shape: ShapeRecord, d: Vec): { id: string; x: number; y: number } {
	const parent = editor.getShape(shape.parentId);
	const local = parent ? vec.rotate(d, -editor.getShapePageRotation(parent)) : d;
	return { id: shape.id, x: shape.x + local.x, y: shape.y + local.y };
}

export function nudgeSelection(editor: Editor, dx: number, dy: number) {
	if (editor.readOnly.peek()) return;
	const ids = editor.getSelectionRoots().map((shape) => shape.id);
	if (ids.length === 0) return;
	editor.history.mark();
	editor.releaseTies(ids);
	editor.updateShapes(ids.map((id) => moved(editor, editor.getShape(id)!, { x: dx, y: dy })));
}

export function alignSelection(editor: Editor, edge: AlignEdge) {
	if (editor.readOnly.peek()) return;
	const shapes = editor.getSelectionRoots();
	const bounds = box.union(shapes.map((shape) => editor.getShapePageBounds(shape)));
	if (shapes.length < 2 || !bounds) return;
	editor.history.mark();
	editor.releaseTies(shapes.map((shape) => shape.id));
	editor.updateShapes(
		shapes.map((shape) => {
			const b = editor.getShapePageBounds(shape);
			const d = { x: 0, y: 0 };
			if (edge === 'left') d.x = bounds.x - b.x;
			else if (edge === 'center') d.x = bounds.x + bounds.w / 2 - (b.x + b.w / 2);
			else if (edge === 'right') d.x = bounds.x + bounds.w - (b.x + b.w);
			else if (edge === 'top') d.y = bounds.y - b.y;
			else if (edge === 'middle') d.y = bounds.y + bounds.h / 2 - (b.y + b.h / 2);
			else d.y = bounds.y + bounds.h - (b.y + b.h);
			return moved(editor, editor.getShape(shape.id)!, d);
		})
	);
}

export function distributeSelection(editor: Editor, axis: 'x' | 'y') {
	if (editor.readOnly.peek()) return;
	const size = axis === 'x' ? 'w' : 'h';
	const items = editor
		.getSelectionRoots()
		.map((shape) => ({ shape, bounds: editor.getShapePageBounds(shape) }))
		.sort((a, b) => a.bounds[axis] - b.bounds[axis]);
	if (items.length < 3) return;
	const first = items[0].bounds;
	const last = items[items.length - 1].bounds;
	const taken = items.reduce((sum, item) => sum + item.bounds[size], 0);
	const gap = (last[axis] + last[size] - first[axis] - taken) / (items.length - 1);
	editor.history.mark();
	editor.releaseTies(items.map((item) => item.shape.id));
	let at = first[axis];
	editor.updateShapes(
		items.map(({ shape, bounds }) => {
			const d = { x: 0, y: 0 };
			d[axis] = at - bounds[axis];
			at += bounds[size] + gap;
			return moved(editor, editor.getShape(shape.id)!, d);
		})
	);
}

export function flipSelection(editor: Editor, axis: 'x' | 'y') {
	if (editor.readOnly.peek()) return;
	const roots = editor.getSelectionRoots();
	const bounds = box.union(roots.map((shape) => editor.getShapePageBounds(shape)));
	// Only what stands upright mirrors cleanly in an upright box.
	const leaves = editor
		.getLeaves(roots)
		.filter(
			(leaf) => editor.getShapePageRotation(leaf) === 0 && editor.util(leaf.kind).canResize(leaf)
		);
	if (!bounds || leaves.length === 0) return;
	editor.history.mark();
	editor.updateShapes(
		leaves.map((leaf) => {
			const b = editor.getShapePageBounds(leaf);
			const target =
				axis === 'x'
					? { ...b, x: bounds.x * 2 + bounds.w - b.x - b.w }
					: { ...b, y: bounds.y * 2 + bounds.h - b.y - b.h };
			return editor.getResizePatch(leaf, target, 0, { x: axis === 'x', y: axis === 'y' });
		})
	);
}

export function toggleLock(editor: Editor) {
	if (editor.readOnly.peek()) return;
	const shapes = editor.getSelectedShapes();
	if (shapes.length === 0) return;
	const locked = !shapes.every((shape) => shape.locked);
	editor.history.mark();
	editor.updateShapes(shapes.map((shape) => ({ id: shape.id, locked })));
	if (locked) editor.select([]);
}

export function setStyle(editor: Editor, patch: Partial<ShapeStyle>) {
	if (editor.readOnly.peek()) return;
	editor.style.set({ ...editor.style.peek(), ...patch });
	const leaves = editor
		.getLeaves(editor.getSelectedShapes())
		.filter((leaf) => !editor.isLocked(leaf));
	if (leaves.length === 0) return;
	editor.history.mark();
	editor.updateShapes(leaves.map((leaf) => ({ id: leaf.id, style: patch })));
}
