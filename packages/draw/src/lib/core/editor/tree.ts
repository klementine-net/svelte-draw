/*
 * How shapes hang together: what sits in what, and what a click on a shape picks.
 * Each function is one of the editor's methods: the editor calls it with itself, and the
 * method's documentation is on the `Editor` class.
 */

import { byIndex } from '../indexing.ts';
import type { ShapeRecord } from '../records.ts';
import type { Editor } from '../editor.ts';

export function getLeaves(editor: Editor, shapes: readonly ShapeRecord[]): ShapeRecord[] {
	return shapes.flatMap((shape) =>
		editor.util(shape.kind).group ? editor.getLeaves(editor.getChildren(shape.id)) : [shape]
	);
}

export function isLocked(editor: Editor, shape: ShapeRecord): boolean {
	for (let current: ShapeRecord | undefined = shape; current;)
		if (current.locked) return true;
		else current = editor.getShape(current.parentId);
	return false;
}

export function getSelectable(editor: Editor, shape: ShapeRecord): ShapeRecord {
	const focus = editor.focusedGroup.peek();
	let result = shape;
	for (let parent = editor.getShape(shape.parentId); parent && parent.id !== focus;) {
		if (editor.util(parent.kind).group) result = parent;
		parent = editor.getShape(parent.parentId);
	}
	return result;
}

export function isInFocus(editor: Editor, shape: ShapeRecord): boolean {
	const focus = editor.focusedGroup.peek();
	if (!focus) return true;
	for (let parent = editor.getShape(shape.parentId); parent;) {
		if (parent.id === focus) return true;
		parent = editor.getShape(parent.parentId);
	}
	return false;
}

export function siblings(editor: Editor, parentId: string): ShapeRecord[] {
	return editor.store
		.snapshot()
		.filter((r): r is ShapeRecord => r.type === 'shape' && r.parentId === parentId)
		.sort(byIndex);
}

export function topIndex(editor: Editor, parentId: string): string | undefined {
	return siblings(editor, parentId).at(-1)?.index;
}
