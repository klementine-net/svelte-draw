/*
 * The selection: what is picked, the box its handles sit on, and the handles.
 * Each function is one of the editor's methods: the editor calls it with itself, and the
 * method's documentation is on the `Editor` class.
 */

import { box, vec, type Box, type Vec } from '../geometry.ts';
import type { ShapeRecord } from '../records.ts';
import type { ShapeHandle } from '../shape-util.ts';
import type { Editor, ShapePatch } from '../editor.ts';
import { HIT_MARGIN, ROTATE_HANDLE_DISTANCE, tidyAngle, type Handle } from './constants.ts';

export function selectAll(editor: Editor) {
	const ids = new Set<string>();
	for (const shape of editor.getShapes())
		if (!editor.util(shape.kind).group && !editor.isLocked(shape) && editor.isInFocus(shape))
			ids.add(editor.getSelectable(shape).id);
	editor.select([...ids]);
}

export function getSelectionRoots(editor: Editor): ShapeRecord[] {
	const selected = new Set(editor.selection.get());
	return editor.getSelectedShapes().filter((shape) => {
		if (editor.isLocked(shape)) return false;
		for (let parent = editor.getShape(shape.parentId); parent;) {
			if (selected.has(parent.id)) return false;
			parent = editor.getShape(parent.parentId);
		}
		return true;
	});
}

export function getSelectionBounds(editor: Editor): Box | undefined {
	return box.union(editor.getSelectedShapes().map((shape) => editor.getShapePageBounds(shape)));
}

export function getSelectionFrame(editor: Editor): { rotation: number; bounds: Box } | undefined {
	const shapes = editor.getSelectedShapes();
	if (shapes.length === 1) {
		const [shape] = shapes;
		const rotation = editor.getShapePageRotation(shape);
		if (rotation !== 0) {
			const origin = vec.rotate(editor.getShapePageOrigin(shape), -rotation);
			return { rotation, bounds: box.translate(editor.util(shape.kind).bounds(shape), origin) };
		}
	}
	const bounds = editor.getSelectionBounds();
	return bounds && { rotation: 0, bounds };
}

export function canResizeSelection(editor: Editor): boolean {
	const shapes = editor.getSelectedShapes();
	if (shapes.length === 0 || editor.getShapeHandles()) return false;
	const rotation = shapes.length === 1 ? editor.getShapePageRotation(shapes[0]) : 0;
	return (
		shapes.every((shape) => !editor.isLocked(shape)) &&
		editor
			.getLeaves(shapes)
			.every(
				(leaf) =>
					editor.util(leaf.kind).canResize(leaf) &&
					tidyAngle(editor.getShapePageRotation(leaf) - rotation) === 0
			)
	);
}

export function canRotateSelection(editor: Editor): boolean {
	return editor.getSelectionRoots().length > 0 && !editor.getShapeHandles();
}

export function getRotateHandle(editor: Editor): Vec | null {
	const frame = editor.getSelectionFrame();
	if (!frame || !editor.canRotateSelection()) return null;
	const { bounds, rotation } = frame;
	const above = ROTATE_HANDLE_DISTANCE / editor.camera.get().z;
	return vec.rotate({ x: bounds.x + bounds.w / 2, y: bounds.y - above }, rotation);
}

export function isRotateHandleAt(editor: Editor, screen: Vec): boolean {
	const handle = editor.getRotateHandle();
	return !!handle && vec.dist(editor.pageToScreen(handle), screen) <= HIT_MARGIN + 3;
}

export function getResizePatch(
	editor: Editor,
	shape: ShapeRecord,
	target: Box,
	rotation: number,
	flip: { x: boolean; y: boolean }
): { id: string } & ShapePatch {
	const origin = vec.rotate(editor.getShapePageOrigin(shape), -rotation);
	const local = box.translate(target, { x: shape.x - origin.x, y: shape.y - origin.y });
	const result = editor.util(shape.kind).resize(shape, local, flip);
	const moved = vec.rotate({ x: result.x - shape.x, y: result.y - shape.y }, shape.rotation ?? 0);
	return { id: shape.id, x: shape.x + moved.x, y: shape.y + moved.y, props: result.props };
}

export function getShapeHandles(
	editor: Editor
): { shape: ShapeRecord; handles: ShapeHandle[] } | null {
	const selection = editor.selection.get();
	const shape = selection.length === 1 ? editor.getShape(selection[0]) : undefined;
	if (!shape || editor.isLocked(shape)) return null;
	const handles = editor.util(shape.kind).handles(shape);
	if (handles.length === 0) return null;
	return {
		shape,
		handles: handles.map(({ id, x, y }) => ({ id, ...editor.shapeToPage(shape, { x, y }) }))
	};
}

export function getShapeHandleAt(editor: Editor, screen: Vec): string | null {
	// The last handle wins where two overlap: a line just begun is grabbed by its end.
	const handles = editor.getShapeHandles()?.handles ?? [];
	for (let i = handles.length - 1; i >= 0; i--)
		if (vec.dist(editor.pageToScreen(handles[i]), screen) <= HIT_MARGIN + 2) return handles[i].id;
	return null;
}

export function getHandleAt(editor: Editor, screen: Vec): Handle | null {
	const frame = editor.getSelectionFrame();
	if (!frame || !editor.canResizeSelection()) return null;
	const { bounds } = frame;
	const p = vec.rotate(editor.screenToPage(screen), -frame.rotation);
	const reach = (HIT_MARGIN + 2) / editor.camera.peek().z;
	const near = (value: number, target: number) => Math.abs(value - target) <= reach;
	const left = near(p.x, bounds.x);
	const right = near(p.x, bounds.x + bounds.w);
	const top = near(p.y, bounds.y);
	const bottom = near(p.y, bounds.y + bounds.h);
	if (top && left) return 'top_left';
	if (top && right) return 'top_right';
	if (bottom && right) return 'bottom_right';
	if (bottom && left) return 'bottom_left';
	const withinX = p.x > bounds.x && p.x < bounds.x + bounds.w;
	const withinY = p.y > bounds.y && p.y < bounds.y + bounds.h;
	if (top && withinX) return 'top';
	if (bottom && withinX) return 'bottom';
	if (left && withinY) return 'left';
	if (right && withinY) return 'right';
	return null;
}
