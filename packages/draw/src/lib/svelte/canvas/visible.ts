/* Which shapes are drawn: only what is on screen and a little around it, so a large board stays light. */

import { box, type Editor } from '../../core.ts';

/** The ids of the shapes to draw now, bottom to top. Read inside a `$derived`. */
export function visibleShapeIds(editor: Editor): readonly string[] {
	const ids = editor.getShapeIds();
	const view = editor.getViewportPageBounds();
	// (Not before the canvas knows its own size: then everything would count as off screen.)
	if (!editor.culling.get() || view.w === 0 || view.h === 0) return ids;
	const margin = 200 / editor.camera.get().z;
	const area = {
		x: view.x - margin,
		y: view.y - margin,
		w: view.w + margin * 2,
		h: view.h + margin * 2
	};
	// What is selected or typed into stays, wherever it is.
	const kept = new Set([...editor.selection.get(), editor.editing.get()]);
	return ids.filter((id) => {
		if (kept.has(id)) return true;
		const shape = editor.getShape(id);
		return !!shape && box.intersects(area, editor.getShapePageBounds(shape));
	});
}
