/*
 * The canvas and the system clipboard, and files dropped on the canvas. Shapes travel as JSON
 * under a type of their own, so they paste into another canvas (another tab, another app
 * built on Draw) and never into a text field as a wall of JSON.
 */

import type { AssetRecord, Editor, ShapeRecord, Vec } from '../../index.ts';
import { inField } from './input.ts';

export const CLIPBOARD_TYPE = 'application/x-svelte-draw';

/** Puts the selection on the clipboard; with `cut`, removes it from the canvas too. */
export function copyShapes(editor: Editor, event: ClipboardEvent, cut = false) {
	if (inField(event) || !event.clipboardData) return;
	const content = cut ? editor.cut() : editor.copy();
	if (content.length === 0) return;
	// With the files the shapes show, so a picture arrives whole in another tab.
	const assets = editor.getContentAssets(content);
	event.clipboardData.setData(CLIPBOARD_TYPE, JSON.stringify({ shapes: content, assets }));
	// What the shapes say, for a paste into a text field.
	const text = content
		.map((shape) => shape.props.text)
		.filter((value) => typeof value === 'string' && value !== '')
		.join('\n');
	event.clipboardData.setData('text/plain', text);
	event.preventDefault();
}

/** Pastes what is on the clipboard: shapes, else a picture, else text. */
export function pasteInto(editor: Editor, event: ClipboardEvent) {
	if (inField(event) || !event.clipboardData) return;
	event.preventDefault();
	const { w, h } = editor.viewport.peek();
	const { screen } = editor.inputs;
	// At the pointer when it is over the canvas, in the middle of the view otherwise.
	const over = screen.x >= 0 && screen.y >= 0 && screen.x <= w && screen.y <= h;
	const at = over ? editor.inputs.page : editor.screenToPage({ x: w / 2, y: h / 2 });
	const data = event.clipboardData.getData(CLIPBOARD_TYPE);
	if (data) {
		try {
			const { shapes, assets } = JSON.parse(data) as {
				shapes?: ShapeRecord[];
				assets?: AssetRecord[];
			};
			if (Array.isArray(shapes)) return editor.paste(shapes, at, assets);
		} catch {
			// Not ours after all: fall through to plain text.
		}
	}
	// A copied picture (a screenshot, an image from another app).
	const files = [...event.clipboardData.files];
	if (files.length > 0) return void editor.addFiles(files, at);
	const text = event.clipboardData.getData('text/plain').trim();
	if (text) editor.pasteText(text, at);
}

/** Files dropped on the canvas land at `point` (pixels from the canvas's top left). */
export function dropFiles(editor: Editor, event: DragEvent, point: Vec) {
	const files = [...(event.dataTransfer?.files ?? [])];
	if (files.length === 0) return;
	event.preventDefault();
	void editor.addFiles(files, editor.screenToPage(point));
}
