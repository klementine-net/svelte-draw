import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	BoxTool,
	corePlugins,
	Editor,
	GEO_KINDS,
	geoPoints,
	lineEnds,
	pointer,
	ShapeUtil,
	type Box,
	type LineShape,
	type ShapeRecord
} from '../src/lib/index.ts';
import { makeEditor, drag, key, near, solid, rect, click } from './helpers.ts';

test('editing: double click or Enter starts it, Escape or a press elsewhere ends it, one undo step', () => {
	type Card = ShapeRecord<'card', { w: number; h: number; text: string }>;
	class CardUtil extends ShapeUtil<Card> {
		static override kind = 'card';
		defaultProps() {
			return { w: 100, h: 100, text: '' };
		}
		bounds(shape: Card): Box {
			return { x: 0, y: 0, w: shape.props.w, h: shape.props.h };
		}
		override canEdit() {
			return true;
		}
		resize(shape: Card, target: Box) {
			return { x: target.x, y: target.y, props: { ...shape.props, w: target.w, h: target.h } };
		}
	}
	class CardTool extends BoxTool {
		static override id = 'card';
		shape = { kind: 'card' };
		override edit = true;
	}
	const editor = makeEditor([
		...corePlugins,
		{ name: 'card', shapes: [CardUtil], tools: [CardTool] }
	]);
	const doubleClick = (x: number, y: number) =>
		editor.dispatch({ ...pointer('down', { x, y }), type: 'double_click' });
	const key = (name: string) =>
		editor.dispatch({
			type: 'key',
			name: 'down',
			key: name,
			repeat: false,
			shift: false,
			alt: false,
			meta: false
		});

	const card = editor.createShape({ kind: 'card', x: 100, y: 100, props: { text: 'old' } });
	const geo = editor.createShape({
		kind: 'draw',
		x: 400,
		y: 150,
		props: {
			points: [
				[0, 0, 0.5],
				[100, 0, 0.5]
			],
			done: true
		}
	});
	editor.history.clear();

	// A shape that holds no text is not edited.
	doubleClick(450, 150);
	assert.equal(editor.editing.peek(), null);

	doubleClick(150, 150);
	assert.equal(editor.editing.peek(), card.id);
	assert.deepEqual(editor.selection.peek(), [card.id]);
	assert.equal(editor.inputs.isDown, false);

	// While typing, keys are the text's: no tool switch, no delete.
	for (const text of ['n', 'ne', 'new']) editor.updateShape(card.id, { props: { text } });
	key('r');
	key('Backspace');
	assert.equal(editor.tool, 'select');
	assert.equal(editor.getShape(card.id)?.props.text, 'new');

	key('Escape');
	assert.equal(editor.editing.peek(), null);
	assert.deepEqual(editor.selection.peek(), [card.id]);
	editor.undo();
	assert.equal(editor.getShape(card.id)?.props.text, 'old');
	editor.redo();
	assert.equal(editor.getShape(card.id)?.props.text, 'new');

	// Enter edits the one selected shape; a press on another shape ends it and selects that.
	key('Enter');
	assert.equal(editor.editing.peek(), card.id);
	editor.dispatch(pointer('down', { x: 450, y: 150 }));
	editor.dispatch(pointer('up', { x: 450, y: 150 }));
	assert.equal(editor.editing.peek(), null);
	assert.deepEqual(editor.selection.peek(), [geo.id]);

	// A new shape that holds text is typed into straight away, clicked or dragged out.
	editor.setTool('card');
	editor.dispatch(pointer('down', { x: 700, y: 500 }));
	editor.dispatch(pointer('up', { x: 700, y: 500 }));
	assert.equal(editor.toolPath.peek(), 'select.editing');
	editor.setTool('card');
	assert.equal(editor.editing.peek(), null);
	drag(editor, [100, 400], [220, 520]);
	const made = editor.selection.peek()[0];
	assert.equal(editor.editing.peek(), made);

	// Removing the shape (an undo, someone else) ends the edit.
	editor.store.remove([made], 'remote');
	assert.equal(editor.editing.peek(), null);
	assert.equal(editor.toolPath.peek(), 'select.idle');
});

test('geo kinds: every outline fills its box; a star is hit on its points, not between them', () => {
	for (const geo of GEO_KINDS) {
		if (geo === 'ellipse') continue;
		const points = geoPoints(geo, 200, 100);
		assert.ok(points.length >= 3, geo);
		near(Math.min(...points.map((p) => p.x)), 0, 0.5);
		near(Math.max(...points.map((p) => p.x)), 200, 0.5);
		near(Math.min(...points.map((p) => p.y)), 0, 0.5);
		near(Math.max(...points.map((p) => p.y)), 100, 0.5);
	}
	const editor = makeEditor();
	editor.setTool('star');
	drag(editor, [100, 100], [300, 300]);
	const [star] = editor.getShapes();
	assert.equal(star.props.geo, 'star');
	editor.updateShape(star.id, { style: solid });
	assert.equal(editor.getShapeAtPoint({ x: 200, y: 210 })?.id, star.id);
	// The top left of its box is between two points: empty.
	assert.equal(editor.getShapeAtPoint({ x: 115, y: 115 }), undefined);
	// An arrow to it stops at the tip of its top point, not at the box.
	const arrow = editor.createShape({ kind: 'line', x: 200, y: 0, props: { end: star.id } });
	const { end } = lineEnds(editor, editor.getShape<LineShape>(arrow.id)!);
	assert.ok(end.y > 85 && end.y < 100, String(end.y));
});

test('the text tool: a click starts a text; nothing typed leaves no trace; typed is one undo step', () => {
	const editor = makeEditor();
	editor.setTool('text');
	click(editor, 200, 200);
	const id = editor.editing.peek()!;
	assert.equal(editor.getShape(id)?.kind, 'text');
	editor.dispatch(key('Escape'));
	assert.equal(editor.getShapes().length, 0);
	assert.equal(editor.history.canUndo.peek(), false);

	editor.setTool('text');
	click(editor, 200, 200);
	const text = editor.editing.peek()!;
	editor.updateShape(text, { props: { text: 'Hello', w: 80, h: 30 } });
	click(editor, 600, 600);
	assert.equal(editor.editing.peek(), null);
	assert.equal(editor.getShape(text)?.props.text, 'Hello');
	editor.undo();
	assert.equal(editor.getShapes().length, 0);

	// What a screen measures is the text's size there, and writes nothing: no undo step.
	editor.pasteText('Pasted', { x: 300, y: 300 });
	const [pasted] = editor.getSelectedShapes();
	assert.equal(pasted.props.text, 'Pasted');
	editor.history.clear();
	editor.setMeasured(pasted.id, { w: 120, h: 40 });
	assert.deepEqual(editor.getShapePageBounds(pasted), { x: pasted.x, y: pasted.y, w: 120, h: 40 });
	assert.equal(editor.history.canUndo.peek(), false);
	assert.equal(editor.getShape(pasted.id), pasted);
});

test('the eraser removes what it is dragged over, in one undo step; the highlighter marks', () => {
	const editor = makeEditor();
	rect(editor, 100, 100);
	rect(editor, 300, 100);
	rect(editor, 500, 100);
	editor.history.clear();
	editor.setTool('eraser');
	editor.dispatch(pointer('down', { x: 150, y: 150 }));
	editor.dispatch(pointer('move', { x: 360, y: 150 }));
	assert.equal(editor.erasing.peek().length, 2);
	assert.equal(editor.getShapes().length, 3);
	editor.dispatch(pointer('up', { x: 360, y: 150 }));
	assert.equal(editor.getShapes().length, 1);
	assert.equal(editor.tool, 'eraser');
	editor.undo();
	assert.equal(editor.getShapes().length, 3);
	// Escape during the drag keeps everything.
	editor.dispatch(pointer('down', { x: 150, y: 150 }));
	editor.dispatch(key('Escape'));
	assert.equal(editor.getShapes().length, 3);
	assert.deepEqual(editor.erasing.peek(), []);

	editor.setTool('highlight');
	drag(editor, [100, 400], [300, 400]);
	const stroke = editor.getShapes().at(-1)!;
	assert.deepEqual([stroke.kind, stroke.props.highlight], ['draw', true]);
});

test('images: a file becomes an asset and a shape; a copy carries the file; arrows get heads and words', async () => {
	const editor = new Editor({
		plugins: corePlugins,
		assets: { upload: async () => 'https://files.example/cat.png' }
	});
	editor.viewport.set({ w: 1000, h: 800 });
	// No browser here to read a picture's size: the image kind is handed a made-up file through
	// a util of its own that skips the measuring.
	const util = editor.util('image');
	util.fromFile = async (file: Blob) =>
		file.type.startsWith('image/')
			? {
					props: { assetId: 'asset:cat', w: 400, h: 300 },
					assets: [
						{
							id: 'asset:cat',
							type: 'asset',
							name: 'cat.png',
							mime: file.type,
							w: 800,
							h: 600,
							src: await editor.assets.upload(file)
						}
					]
				}
			: undefined;
	const made = await editor.addFiles(
		[new Blob(['x'], { type: 'image/png' }), new Blob(['y'], { type: 'text/csv' })],
		{ x: 500, y: 400 }
	);
	assert.equal(made.length, 1);
	const [image] = editor.getSelectedShapes();
	assert.deepEqual([image.kind, image.x, image.y], ['image', 300, 250]);
	assert.equal(
		(editor.store.get('asset:cat') as { src: string }).src,
		'https://files.example/cat.png'
	);
	// One undo takes back the picture and its file; a delete alone keeps the file for an undo.
	editor.undo();
	assert.equal(editor.store.has('asset:cat'), false);
	editor.redo();
	editor.deleteShapes([image.id]);
	assert.ok(editor.store.has('asset:cat'));
	editor.undo();

	// A copy that leaves the document takes the file with it.
	editor.select([image.id]);
	const content = editor.copy();
	const assets = editor.getContentAssets(content);
	assert.equal(assets.length, 1);
	const other = makeEditor();
	other.paste(JSON.parse(JSON.stringify(content)), { x: 0, y: 0 }, assets);
	assert.ok(other.store.has('asset:cat'));
	assert.equal(other.getShapes()[0].props.assetId, 'asset:cat');

	// A line's switches: a head at the start; and it can be written on.
	const line = editor.createShape({ kind: 'line', x: 0, y: 0, props: { dx: 100, dy: 0 } });
	editor.select([line.id]);
	editor.toggleSelection('arrowStart');
	assert.equal(editor.getShape(line.id)?.props.arrowStart, true);
	assert.equal(editor.canEdit(line.id), true);

	// Read-only: nothing changes, only the view moves.
	editor.setReadOnly(true);
	assert.equal(editor.tool, 'hand');
	editor.setTool('draw');
	assert.equal(editor.tool, 'hand');
	editor.undo();
	assert.equal(editor.getShape(line.id)?.props.arrowStart, true);
	// What the keys and the right-click menu would do is refused too.
	editor.select([line.id]);
	editor.deleteSelection();
	editor.duplicateSelection();
	editor.nudgeSelection(10, 0);
	editor.setStyle({ color: 'red' });
	assert.equal(editor.getShapes().filter((shape) => shape.kind === 'line').length, 1);
	assert.deepEqual(
		[editor.getShape(line.id)?.x, editor.getShape(line.id)?.style.color],
		[0, 'ink']
	);
});
