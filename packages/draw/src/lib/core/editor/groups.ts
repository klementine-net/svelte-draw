/*
 * Making a group of the selection, and taking groups apart.
 * Each function is one of the editor's methods: the editor calls it with itself, and the
 * method's documentation is on the `Editor` class.
 */

import { vec } from '../geometry.ts';
import { indexBetween } from '../indexing.ts';
import type { Editor } from '../editor.ts';
import { tidyAngle } from './constants.ts';

/** The kind that groups, if a plugin brought one. */
function groupKind(editor: Editor): string | undefined {
	for (const [kind, util] of editor.getUtils()) if (util.group) return kind;
	return undefined;
}

export function canGroupSelection(editor: Editor): boolean {
	const roots = editor.getSelectionRoots();
	return (
		!!groupKind(editor) &&
		roots.length > 1 &&
		roots.every((shape) => shape.parentId === roots[0].parentId)
	);
}

export function groupSelection(editor: Editor) {
	if (editor.readOnly.peek()) return;
	const kind = groupKind(editor);
	if (!kind || !editor.canGroupSelection()) return;
	const picked = new Set(editor.getSelectionRoots().map((shape) => shape.id));
	const shapes = editor.getShapes().filter((shape) => picked.has(shape.id));
	const parentId = shapes[0].parentId;
	const at = { x: Math.min(...shapes.map((s) => s.x)), y: Math.min(...shapes.map((s) => s.y)) };
	editor.history.mark();
	let groupId = '';
	editor.store.transact(() => {
		groupId = editor.createShape({
			kind,
			parentId,
			index: shapes[shapes.length - 1].index,
			x: at.x,
			y: at.y
		}).id;
		editor.updateShapes(
			shapes.map((shape) => ({
				id: shape.id,
				parentId: groupId,
				x: shape.x - at.x,
				y: shape.y - at.y
			}))
		);
	});
	editor.history.mark();
	editor.select([groupId]);
}

export function ungroupSelection(editor: Editor) {
	if (editor.readOnly.peek()) return;
	const groups = editor.getSelectedShapes().filter((shape) => editor.util(shape.kind).group);
	if (groups.length === 0) return;
	const freed: string[] = [];
	editor.history.mark();
	editor.store.transact(() => {
		for (const group of groups) {
			const siblings = editor.getChildren(group.parentId);
			const at = siblings.findIndex((shape) => shape.id === group.id);
			let below = siblings[at - 1]?.index;
			const above = siblings[at + 1]?.index;
			const turn = group.rotation ?? 0;
			editor.updateShapes(
				editor.getChildren(group.id).map((child) => {
					const place = vec.add(vec.rotate(child, turn), group);
					below = indexBetween(below, above);
					freed.push(child.id);
					return {
						id: child.id,
						parentId: group.parentId,
						index: below,
						x: place.x,
						y: place.y,
						rotation: tidyAngle((child.rotation ?? 0) + turn)
					};
				})
			);
			editor.store.remove([group.id]);
		}
	});
	editor.history.mark();
	editor.select(freed);
}
