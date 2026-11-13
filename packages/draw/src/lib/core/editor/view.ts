/*
 * The view: screen and page coordinates, panning and zooming.
 * Each function is one of the editor's methods: the editor calls it with itself, and the
 * method's documentation is on the `Editor` class.
 */

import { box, type Box, type Vec } from '../geometry.ts';
import type { Editor } from '../editor.ts';
import { MIN_ZOOM, MAX_ZOOM, ZOOM_STEPS } from './constants.ts';

export function screenToPage(editor: Editor, point: Vec): Vec {
	const { x, y, z } = editor.camera.peek();
	return { x: (point.x - x) / z, y: (point.y - y) / z };
}

export function pageToScreen(editor: Editor, point: Vec): Vec {
	const { x, y, z } = editor.camera.peek();
	return { x: point.x * z + x, y: point.y * z + y };
}

export function pan(editor: Editor, dx: number, dy: number) {
	const { x, y, z } = editor.camera.peek();
	editor.camera.set({ x: x + dx, y: y + dy, z });
}

export function zoomTo(editor: Editor, zoom: number, anchor?: Vec) {
	const { x, y, z } = editor.camera.peek();
	const { w, h } = editor.viewport.peek();
	const at = anchor ?? { x: w / 2, y: h / 2 };
	const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
	editor.camera.set({
		x: at.x - ((at.x - x) * next) / z,
		y: at.y - ((at.y - y) * next) / z,
		z: next
	});
}

export function zoomIn(editor: Editor) {
	const { z } = editor.camera.peek();
	editor.zoomTo(ZOOM_STEPS.find((step) => step > z * 1.001) ?? MAX_ZOOM);
}

export function zoomOut(editor: Editor) {
	const { z } = editor.camera.peek();
	editor.zoomTo(ZOOM_STEPS.findLast((step) => step < z * 0.999) ?? MIN_ZOOM);
}

export function resetZoom(editor: Editor) {
	editor.zoomTo(1);
}

export function zoomToFit(editor: Editor) {
	const bounds = box.union(editor.getShapes().map((shape) => editor.getShapePageBounds(shape)));
	const { w, h } = editor.viewport.peek();
	if (!bounds || w === 0 || h === 0) return;
	const padding = 64;
	const z = Math.min(
		1,
		Math.max(MIN_ZOOM, Math.min((w - padding * 2) / bounds.w, (h - padding * 2) / bounds.h))
	);
	const centre = box.center(bounds);
	editor.camera.set({ x: w / 2 - centre.x * z, y: h / 2 - centre.y * z, z });
}

export function zoomToBounds(editor: Editor, bounds: Box, padding = 32) {
	const { w, h } = editor.viewport.peek();
	if (w === 0 || h === 0) return;
	const z = Math.max(
		MIN_ZOOM,
		Math.min(
			MAX_ZOOM,
			(w - padding * 2) / Math.max(1, bounds.w),
			(h - padding * 2) / Math.max(1, bounds.h)
		)
	);
	const centre = box.center(bounds);
	editor.camera.set({ x: w / 2 - centre.x * z, y: h / 2 - centre.y * z, z });
}

export function getViewportPageBounds(editor: Editor): Box {
	const { w, h } = editor.viewport.get();
	const { x, y, z } = editor.camera.get();
	return { x: -x / z, y: -y / z, w: w / z, h: h / z };
}

export function zoomToSelection(editor: Editor) {
	const bounds = editor.getSelectionBounds();
	const { w, h } = editor.viewport.peek();
	if (!bounds || w === 0 || h === 0) return;
	const padding = 64;
	const z = Math.min(
		1,
		Math.max(
			MIN_ZOOM,
			Math.min((w - padding * 2) / Math.max(1, bounds.w), (h - padding * 2) / Math.max(1, bounds.h))
		)
	);
	const centre = box.center(bounds);
	editor.camera.set({ x: w / 2 - centre.x * z, y: h / 2 - centre.y * z, z });
}
