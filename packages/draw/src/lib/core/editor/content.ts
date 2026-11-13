/*
 * Shapes as content that can leave and enter a document: copy, paste, duplicate, dropped files.
 * Each function is one of the editor's methods: the editor calls it with itself, and the
 * method's documentation is on the `Editor` class.
 */

import { box, vec, type Vec } from '../geometry.ts';
import { createId, type AssetRecord, type ShapeRecord } from '../records.ts';
import type { Editor } from '../editor.ts';

export function getContent(editor: Editor, ids: readonly string[]): ShapeRecord[] {
	const picked = new Set(ids);
	const all = editor.getShapes();
	// Shape ids come parent first, so one pass catches every descendant.
	for (const shape of all) if (picked.has(shape.parentId)) picked.add(shape.id);
	return all
		.filter((shape) => picked.has(shape.id))
		.map((shape) => {
			const retied = editor.util(shape.kind).retie(shape, (id) => (picked.has(id) ? id : null));
			// A copy is never locked.
			const next = {
				...shape,
				...retied,
				locked: undefined,
				props: { ...shape.props, ...retied?.props }
			};
			if (picked.has(shape.parentId)) return next as ShapeRecord;
			// A top one is placed on the page itself, turned as it shows.
			const parent = editor.getShape(shape.parentId);
			const at = parent ? editor.shapeToPage(parent, next) : next;
			const rotation = editor.getShapePageRotation(shape);
			return {
				...next,
				x: at.x,
				y: at.y,
				parentId: '',
				...(rotation ? { rotation } : {})
			} as ShapeRecord;
		});
}

export function getContentAssets(editor: Editor, content: readonly ShapeRecord[]): AssetRecord[] {
	const ids = new Set(
		content.flatMap((shape) =>
			editor.hasUtil(shape.kind) ? editor.util(shape.kind).assets(shape) : []
		)
	);
	return [...ids].flatMap((id) => {
		const record = editor.store.get(id);
		return record?.type === 'asset' ? [record] : [];
	});
}

export function putContent(
	editor: Editor,
	content: readonly ShapeRecord[],
	options: { at?: Vec; offset?: number; assets?: readonly AssetRecord[] } = {}
): ShapeRecord[] {
	const missing = (options.assets ?? []).filter((asset) => !editor.store.has(asset.id));
	if (missing.length > 0) editor.store.put(missing);
	const shapes = content.filter((shape) => editor.hasUtil(shape.kind));
	const ids = new Map(shapes.map((shape) => [shape.id, createId('shape')]));
	const roots = shapes.filter((shape) => !ids.has(shape.parentId));
	if (roots.length === 0) return [];
	let dx = options.offset ?? 16;
	let dy = dx;
	if (options.at) {
		const corners = roots.flatMap((root) =>
			box
				.corners(editor.util(root.kind).bounds(root))
				.map((corner) => vec.add(vec.rotate(corner, root.rotation ?? 0), root))
		);
		const middle = box.center(box.around(corners));
		dx = options.at.x - middle.x;
		dy = options.at.y - middle.y;
	}
	const made = editor.createShapes(
		shapes.map((shape) => {
			const root = !ids.has(shape.parentId);
			// Ties now point at the copies.
			const retied = editor.util(shape.kind).retie(shape, (id) => ids.get(id) ?? null);
			return {
				id: ids.get(shape.id),
				kind: shape.kind,
				parentId: root ? undefined : ids.get(shape.parentId),
				index: root ? undefined : shape.index,
				x: (retied?.x ?? shape.x) + (root ? dx : 0),
				y: (retied?.y ?? shape.y) + (root ? dy : 0),
				rotation: shape.rotation,
				props: { ...shape.props, ...retied?.props },
				style: shape.style
			};
		})
	);
	editor.select(roots.map((root) => ids.get(root.id)!));
	return made;
}

export function duplicateSelection(editor: Editor, offset = 16) {
	if (editor.readOnly.peek()) return;
	const roots = editor.getSelectionRoots();
	if (roots.length === 0) return;
	editor.history.mark();
	editor.putContent(editor.getContent(roots.map((shape) => shape.id)), { offset });
}

export function copy(editor: Editor): ShapeRecord[] {
	const roots = editor.getSelectionRoots();
	if (roots.length > 0) editor.clipboard = editor.getContent(roots.map((shape) => shape.id));
	return roots.length > 0 ? editor.clipboard : [];
}

export function cut(editor: Editor): ShapeRecord[] {
	if (editor.readOnly.peek()) return [];
	const content = editor.copy();
	editor.deleteSelection();
	return content;
}

export function paste(
	editor: Editor,
	content: readonly ShapeRecord[],
	at?: Vec,
	assets?: readonly AssetRecord[]
) {
	if (content.length === 0 || editor.readOnly.peek()) return;
	editor.history.mark();
	const made = editor.putContent(content, { at, assets });
	editor.settle(made.map((shape) => shape.id));
	editor.history.mark();
}

export function pasteText(editor: Editor, text: string, at: Vec) {
	if (editor.readOnly.peek()) return;
	for (const [kind, util] of editor.getUtils()) {
		const props = util.fromText(text);
		if (!props) continue;
		editor.history.mark();
		const shape = editor.createShape({ kind, x: at.x, y: at.y, props });
		const bounds = util.bounds(shape);
		editor.updateShape(shape.id, { x: at.x - bounds.w / 2, y: at.y - bounds.h / 2 });
		editor.select([shape.id]);
		editor.setTool('select');
		editor.settle([shape.id]);
		editor.history.mark();
		return;
	}
}

export async function addFiles(
	editor: Editor,
	files: readonly Blob[],
	at: Vec
): Promise<ShapeRecord[]> {
	if (editor.readOnly.peek()) return [];
	const made: { kind: string; props: Record<string, unknown>; assets: AssetRecord[] }[] = [];
	for (const file of files)
		for (const [kind, util] of editor.getUtils()) {
			const result = await util.fromFile(file);
			if (!result) continue;
			made.push({ kind, ...result });
			break;
		}
	if (made.length === 0) return [];
	editor.history.mark();
	let shapes: ShapeRecord[] = [];
	editor.store.transact(() => {
		editor.store.put(made.flatMap((item) => item.assets));
		// Each a little down and right of the one before, the first centred on the point.
		shapes = editor.createShapes(
			made.map(({ kind, props }, i) => {
				const { w = 0, h = 0 } = props as { w?: number; h?: number };
				return { kind, x: at.x - w / 2 + i * 24, y: at.y - h / 2 + i * 24, props };
			})
		);
	});
	editor.settle(shapes.map((shape) => shape.id));
	editor.history.mark();
	editor.setTool('select');
	editor.select(shapes.map((shape) => shape.id));
	return shapes;
}
