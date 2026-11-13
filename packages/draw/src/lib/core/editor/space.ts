/*
 * Where shapes are: the way between a shape's own space and the page, and what is at a point.
 * Each function is one of the editor's methods: the editor calls it with itself, and the
 * method's documentation is on the `Editor` class.
 */

import { box, vec, type Box, type Vec } from '../geometry.ts';
import type { ShapeRecord } from '../records.ts';
import type { Editor } from '../editor.ts';
import { HIT_MARGIN, tidyAngle } from './constants.ts';

export function getBindTargetAt(
	editor: Editor,
	point: Vec,
	exclude: readonly (string | null | undefined)[] = []
): ShapeRecord | undefined {
	const shapes = editor.getShapes();
	for (let i = shapes.length - 1; i >= 0; i--) {
		const shape = shapes[i];
		const util = editor.util(shape.kind);
		if (exclude.includes(shape.id) || !util.canBind(shape) || editor.isLocked(shape)) continue;
		if (box.contains(util.bounds(shape), editor.pageToShape(shape, point))) return shape;
	}
	return undefined;
}

export function getShapePageRotation(editor: Editor, shape: ShapeRecord): number {
	let rotation = shape.rotation ?? 0;
	for (let parent = editor.getShape(shape.parentId); parent;) {
		rotation += parent.rotation ?? 0;
		parent = editor.getShape(parent.parentId);
	}
	return tidyAngle(rotation);
}

export function shapeToPage(editor: Editor, shape: ShapeRecord, point: Vec): Vec {
	let p = point;
	for (let current: ShapeRecord | undefined = shape; current;) {
		p = vec.add(vec.rotate(p, current.rotation ?? 0), current);
		current = editor.getShape(current.parentId);
	}
	return p;
}

export function pageToShape(editor: Editor, shape: ShapeRecord, point: Vec): Vec {
	return vec.rotate(vec.sub(editor.pageToParent(shape, point), shape), -(shape.rotation ?? 0));
}

export function pageToParent(editor: Editor, shape: ShapeRecord, point: Vec): Vec {
	const parent = editor.getShape(shape.parentId);
	return parent ? editor.pageToShape(parent, point) : point;
}

export function getShapePageOrigin(editor: Editor, shape: ShapeRecord): Vec {
	return editor.shapeToPage(shape, { x: 0, y: 0 });
}

export function getShapePageBounds(editor: Editor, shape: ShapeRecord): Box {
	const bounds = editor.util(shape.kind).bounds(shape);
	return box.around(box.corners(bounds).map((corner) => editor.shapeToPage(shape, corner)));
}

export function getShapeAtPoint(
	editor: Editor,
	point: Vec,
	options: { locked?: boolean } = {}
): ShapeRecord | undefined {
	const margin = HIT_MARGIN / editor.camera.peek().z;
	const shapes = editor.getShapes();
	for (let i = shapes.length - 1; i >= 0; i--) {
		const shape = shapes[i];
		if (!options.locked && editor.isLocked(shape)) continue;
		if (!editor.util(shape.kind).hitTest(shape, editor.pageToShape(shape, point), margin)) continue;
		if (!cutOff(editor, shape, point)) return shape;
	}
	return undefined;
}

/** Whether `point` lies outside a frame the shape sits in, where the shape is not shown. */
function cutOff(editor: Editor, shape: ShapeRecord, point: Vec): boolean {
	for (let parent = editor.getShape(shape.parentId); parent;) {
		const util = editor.util(parent.kind);
		if (util.frame && !box.contains(util.bounds(parent), editor.pageToShape(parent, point)))
			return true;
		parent = editor.getShape(parent.parentId);
	}
	return false;
}

export function getShapesInBox(editor: Editor, area: Box): ShapeRecord[] {
	return editor
		.getShapes()
		.filter(
			(shape) => !editor.isLocked(shape) && box.intersects(area, editor.getShapePageBounds(shape))
		);
}
