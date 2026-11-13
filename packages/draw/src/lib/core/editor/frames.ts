/*
 * Frames taking in what is dropped on them, and letting go of what leaves.
 * Each function is one of the editor's methods: the editor calls it with itself, and the
 * method's documentation is on the `Editor` class.
 */

import { box } from '../geometry.ts';
import { indexBetween } from '../indexing.ts';
import type { ShapeRecord } from '../records.ts';
import type { Editor } from '../editor.ts';
import { tidyAngle } from './constants.ts';

export function settle(editor: Editor, ids: readonly string[]) {
	const frames = editor.getShapes().filter((shape) => editor.util(shape.kind).frame);
	if (frames.length === 0) return;
	const tops = new Map<string, string | undefined>();
	// One at a time, so a frame that just moved into another is not then given that one.
	editor.store.transact(() => {
		for (const id of ids) settleOne(editor, id, frames, tops);
	});
}

function settleOne(
	editor: Editor,
	id: string,
	frames: ShapeRecord[],
	tops: Map<string, string | undefined>
) {
	const shape = editor.getShape(id);
	if (!shape) return;
	// Only what sits on the page or in a frame moves between them; a group keeps its own.
	const parent = editor.getShape(shape.parentId);
	if (parent && !editor.util(parent.kind).frame) return;
	const middle = box.center(editor.getShapePageBounds(shape));
	let home: ShapeRecord | undefined;
	for (let i = frames.length - 1; i >= 0 && !home; i--) {
		// Read anew: a frame settled a moment ago has a new parent.
		const frame = editor.getShape(frames[i].id);
		// A frame can sit in another frame, but not in itself or in what it holds.
		if (!frame || frame.id === id || isInside(editor, frame, id)) continue;
		if (box.contains(editor.util(frame.kind).bounds(frame), editor.pageToShape(frame, middle)))
			home = frame;
	}
	const homeId = home?.id ?? editor.pageId.peek();
	if (homeId === shape.parentId) return;
	const origin = editor.getShapePageOrigin(shape);
	const place = home ? editor.pageToShape(home, origin) : origin;
	if (!tops.has(homeId)) tops.set(homeId, editor.getChildren(homeId).at(-1)?.index);
	const index = indexBetween(tops.get(homeId));
	tops.set(homeId, index);
	editor.updateShape(id, {
		parentId: homeId,
		index,
		x: place.x,
		y: place.y,
		rotation: tidyAngle(
			editor.getShapePageRotation(shape) - (home ? editor.getShapePageRotation(home) : 0)
		)
	});
}

/** Whether `shape` sits somewhere inside the shape `ancestorId`. */
function isInside(editor: Editor, shape: ShapeRecord, ancestorId: string): boolean {
	for (let parent = editor.getShape(shape.parentId); parent;) {
		if (parent.id === ancestorId) return true;
		parent = editor.getShape(parent.parentId);
	}
	return false;
}
