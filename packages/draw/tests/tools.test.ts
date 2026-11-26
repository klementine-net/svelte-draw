import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	BoxTool,
	corePlugins,
	pointer,
	ShapeUtil,
	type Box,
	type DrawShape,
	type GeoShape,
	type ShapeRecord
} from '../src/lib/core.ts';
import { makeEditor, drag, key } from './helpers.ts';

test('dragging with the rectangle tool makes a shape, and it undoes in one step', () => {
	const editor = makeEditor();
	editor.setTool('rectangle');
	drag(editor, [100, 100], [300, 250]);
	const [shape] = editor.getShapes() as GeoShape[];
	assert.equal(shape.kind, 'geo');
	assert.deepEqual([shape.x, shape.y, shape.props.w, shape.props.h], [100, 100, 200, 150]);
	assert.equal(editor.toolPath.peek(), 'select.idle');
	assert.deepEqual(editor.selection.peek(), [shape.id]);

	editor.undo();
	assert.equal(editor.getShapes().length, 0);
	assert.deepEqual(editor.selection.peek(), []);
	editor.redo();
	assert.equal(editor.getShapes().length, 1);
});

test('a click with the ellipse tool makes a default-size shape around the click', () => {
	const editor = makeEditor();
	editor.setTool('ellipse');
	editor.dispatch(pointer('down', { x: 400, y: 300 }));
	editor.dispatch(pointer('up', { x: 400, y: 300 }));
	const [shape] = editor.getShapes() as GeoShape[];
	assert.equal(shape.props.geo, 'ellipse');
	assert.deepEqual([shape.x, shape.y], [400 - 80, 300 - 60]);
});

test('select: drag moves, escape during a drag puts it back', () => {
	const editor = makeEditor();
	const shape = editor.createShape({ kind: 'geo', x: 100, y: 100, style: { fill: 'solid' } });
	editor.history.mark();
	drag(editor, [150, 150], [250, 190]);
	assert.deepEqual([editor.getShape(shape.id)!.x, editor.getShape(shape.id)!.y], [200, 140]);
	assert.deepEqual(editor.selection.peek(), [shape.id]);

	editor.dispatch(pointer('down', { x: 250, y: 190 }));
	editor.dispatch(pointer('move', { x: 400, y: 400 }));
	assert.equal(editor.toolPath.peek(), 'select.translating');
	editor.dispatch(key('Escape'));
	assert.equal(editor.toolPath.peek(), 'select.idle');
	assert.deepEqual([editor.getShape(shape.id)!.x, editor.getShape(shape.id)!.y], [200, 140]);

	editor.undo();
	assert.deepEqual([editor.getShape(shape.id)!.x, editor.getShape(shape.id)!.y], [100, 100]);
});

test('a hollow shape is picked on its line, not in its middle', () => {
	const editor = makeEditor();
	const shape = editor.createShape({ kind: 'geo', x: 100, y: 100 });
	assert.equal(editor.getShapeAtPoint({ x: 180, y: 160 }), undefined);
	assert.equal(editor.getShapeAtPoint({ x: 100, y: 160 })?.id, shape.id);
});

test('resize from a corner; crossing over flips; shift keeps proportions', () => {
	const editor = makeEditor();
	const shape = editor.createShape({ kind: 'geo', x: 100, y: 100, props: { w: 200, h: 100 } });
	editor.select([shape.id]);
	drag(editor, [300, 200], [400, 300]);
	let now = editor.getShape<GeoShape>(shape.id)!;
	assert.deepEqual([now.x, now.y, now.props.w, now.props.h], [100, 100, 300, 200]);

	// Drag the bottom right corner past the top left one.
	drag(editor, [400, 300], [50, 40]);
	now = editor.getShape<GeoShape>(shape.id)!;
	assert.deepEqual([now.x, now.y, now.props.w, now.props.h], [50, 40, 50, 60]);

	editor.updateShape(shape.id, { x: 0, y: 0, props: { w: 200, h: 100 } });
	drag(editor, [200, 100], [400, 110], { shift: true });
	now = editor.getShape<GeoShape>(shape.id)!;
	assert.deepEqual([now.props.w, now.props.h], [400, 200]);
});

test('resizing a selection of two scales both, and a stroke scales its points', () => {
	const editor = makeEditor();
	editor.setTool('draw');
	drag(editor, [0, 0], [100, 100]);
	editor.setTool('select');
	const stroke = editor.getShapes()[0] as DrawShape;
	const rect = editor.createShape({ kind: 'geo', x: 100, y: 100, props: { w: 100, h: 100 } });
	editor.select([stroke.id, rect.id]);
	drag(editor, [200, 200], [400, 400]);
	const scaled = editor.getShape<DrawShape>(stroke.id)!;
	assert.deepEqual(editor.getShapePageBounds(scaled), { x: 0, y: 0, w: 200, h: 200 });
	const big = editor.getShape<GeoShape>(rect.id)!;
	assert.deepEqual([big.x, big.y, big.props.w, big.props.h], [200, 200, 200, 200]);
});

test('marquee selects what it touches; shift adds', () => {
	const editor = makeEditor();
	const a = editor.createShape({ kind: 'geo', x: 100, y: 100, props: { w: 50, h: 50 } });
	const b = editor.createShape({ kind: 'geo', x: 300, y: 100, props: { w: 50, h: 50 } });
	drag(editor, [80, 80], [200, 200]);
	assert.deepEqual(editor.selection.peek(), [a.id]);
	assert.equal(editor.brush.peek(), null);
	drag(editor, [280, 80], [400, 200], { shift: true });
	assert.deepEqual(editor.selection.peek(), [a.id, b.id]);
	editor.dispatch(key('Delete'));
	assert.equal(editor.getShapes().length, 0);
	editor.undo();
	assert.equal(editor.getShapes().length, 2);
});

test('the camera: page points stay under the pointer while zooming', () => {
	const editor = makeEditor();
	const before = editor.screenToPage({ x: 300, y: 200 });
	editor.dispatch({
		type: 'wheel',
		point: { x: 300, y: 200 },
		delta: { x: 0, y: -50 },
		shift: false,
		alt: false,
		meta: true
	});
	assert.ok(editor.camera.peek().z > 1);
	const after = editor.screenToPage({ x: 300, y: 200 });
	assert.ok(Math.abs(after.x - before.x) < 1e-9 && Math.abs(after.y - before.y) < 1e-9);
});

test('stacking: bring to front and send to back reorder without renumbering others', () => {
	const editor = makeEditor();
	const a = editor.createShape({ kind: 'geo', x: 0, y: 0 });
	const b = editor.createShape({ kind: 'geo', x: 0, y: 0 });
	const c = editor.createShape({ kind: 'geo', x: 0, y: 0 });
	editor.bringToFront([a.id]);
	assert.deepEqual(editor.getShapeIds(), [b.id, c.id, a.id]);
	editor.sendToBack([c.id]);
	assert.deepEqual(editor.getShapeIds(), [c.id, b.id, a.id]);
	assert.equal(editor.getShape(b.id)!.index, b.index);
});

test('a plugin adds a shape and a tool from outside the package', () => {
	type Note = ShapeRecord<'sticker', { w: number; h: number; text: string }>;
	class NoteUtil extends ShapeUtil<Note> {
		static override kind = 'sticker';
		defaultProps() {
			return { w: 200, h: 200, text: '' };
		}
		bounds(shape: Note): Box {
			return { x: 0, y: 0, w: shape.props.w, h: shape.props.h };
		}
		resize(shape: Note, target: Box) {
			return { x: target.x, y: target.y, props: { ...shape.props, w: target.w, h: target.h } };
		}
	}
	class NoteTool extends BoxTool {
		static override id = 'sticker';
		shape = { kind: 'sticker' };
	}
	const editor = makeEditor([
		...corePlugins,
		{ name: 'sticker', shapes: [NoteUtil], tools: [NoteTool], shortcuts: { k: 'sticker' } }
	]);
	editor.dispatch(key('k'));
	assert.equal(editor.tool, 'sticker');
	drag(editor, [10, 10], [110, 60]);
	const [note] = editor.getShapes() as Note[];
	assert.deepEqual(
		[note.kind, note.props.w, note.props.h, note.props.text],
		['sticker', 100, 50, '']
	);
});
