import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	BoxTool,
	corePlugins,
	Editor,
	indexBetween,
	pointer,
	ShapeUtil,
	Store,
	type Box,
	type DrawPlugin,
	type DrawRecord,
	type DrawShape,
	type GeoShape,
	type ShapeRecord
} from '../src/lib/index.ts';

function makeEditor(plugins: DrawPlugin[] = corePlugins, store?: Store<DrawRecord>) {
	const editor = new Editor({ plugins, store });
	editor.viewport.set({ w: 1000, h: 800 });
	return editor;
}

/** Press at `from`, move to `to` in a few steps, release. */
function drag(editor: Editor, from: [number, number], to: [number, number], options = {}) {
	editor.dispatch(pointer('down', { x: from[0], y: from[1] }, options));
	for (let i = 1; i <= 4; i++) {
		const t = i / 4;
		editor.dispatch(
			pointer(
				'move',
				{ x: from[0] + (to[0] - from[0]) * t, y: from[1] + (to[1] - from[1]) * t },
				options
			)
		);
	}
	editor.dispatch(pointer('up', { x: to[0], y: to[1] }, options));
}

const key = (k: string, options = {}) =>
	({
		type: 'key',
		name: 'down',
		key: k,
		repeat: false,
		shift: false,
		alt: false,
		meta: false,
		...options
	}) as const;

test('indexBetween sorts between its neighbours', () => {
	const a = indexBetween();
	const b = indexBetween(a);
	const mid = indexBetween(a, b);
	const below = indexBetween(undefined, a);
	assert.ok(below < a && a < mid && mid < b);
	let low = a;
	for (let i = 0; i < 50; i++) {
		const next = indexBetween(low, mid);
		assert.ok(low < next && next < mid);
		low = next;
	}
});

test('a thousand shapes on top of each other keep short indexes, in order', () => {
	const editor = makeEditor();
	const made = editor.createShapes(
		Array.from({ length: 1000 }, (_, i) => ({ kind: 'geo', x: i, y: 0 }))
	);
	assert.ok(made.every((shape) => shape.index.length <= 4));
	assert.deepEqual(
		editor.getShapeIds(),
		made.map((shape) => shape.id)
	);
});

test('two shapes with the same index stack the same way on both sides', () => {
	const a = makeEditor();
	const b = makeEditor();
	// Both make a first shape at the same moment: the same index, different ids.
	const one = a.createShape({ kind: 'geo', x: 0, y: 0 });
	const two = b.createShape({ kind: 'geo', x: 0, y: 0 });
	assert.equal(one.index, two.index);
	a.store.put([two], 'remote');
	b.store.put([one], 'remote');
	assert.deepEqual(a.getShapeIds(), b.getShapeIds());
});

test('a transaction announces one diff', () => {
	const store = new Store<DrawRecord>();
	const diffs: unknown[] = [];
	store.listen((diff) => diffs.push(diff));
	const editor = makeEditor(corePlugins, store);
	editor.store.transact(() => {
		const shape = editor.createShape({ kind: 'geo', x: 0, y: 0 });
		editor.updateShape(shape.id, { x: 5 });
	});
	// One for the page the editor made, one for the transaction.
	assert.equal(diffs.length, 2);
	const last = diffs[1] as { added: Record<string, ShapeRecord>; updated: object };
	assert.equal(Object.values(last.added)[0].x, 5);
	assert.deepEqual(last.updated, {});
});

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
	type Note = ShapeRecord<'note', { w: number; h: number; text: string }>;
	class NoteUtil extends ShapeUtil<Note> {
		static override kind = 'note';
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
		static override id = 'note';
		shape = { kind: 'note' };
	}
	const editor = makeEditor([
		...corePlugins,
		{ name: 'note', shapes: [NoteUtil], tools: [NoteTool], shortcuts: { n: 'note' } }
	]);
	editor.dispatch(key('n'));
	assert.equal(editor.tool, 'note');
	drag(editor, [10, 10], [110, 60]);
	const [note] = editor.getShapes() as Note[];
	assert.deepEqual([note.kind, note.props.w, note.props.h, note.props.text], ['note', 100, 50, '']);
});

test('sync seam: two stores converge through diffs, and undo leaves remote work alone', () => {
	const a = makeEditor();
	const b = makeEditor();
	// The simplest possible transport: every user change on one side is applied on the other.
	a.store.listen((diff, source) => source === 'user' && b.store.applyDiff(diff, 'remote'));
	b.store.listen((diff, source) => source === 'user' && a.store.applyDiff(diff, 'remote'));

	const mine = a.createShape({ kind: 'geo', x: 0, y: 0 });
	a.history.mark();
	const theirs = b.createShape({ kind: 'geo', x: 500, y: 500 });
	b.updateShape(mine.id, { x: 42 });
	assert.deepEqual(a.store.snapshot().sort(byId), b.store.snapshot().sort(byId));
	assert.equal(a.getShape(mine.id)!.x, 42);

	// A's undo history holds only A's own step.
	a.undo();
	assert.equal(a.getShape(mine.id), undefined);
	assert.ok(a.getShape(theirs.id));
	assert.equal(b.getShape(mine.id), undefined);
	assert.equal(a.history.canUndo.peek(), false);
});

const byId = (x: DrawRecord, y: DrawRecord) => (x.id < y.id ? -1 : 1);

test('the arrow tool drags out an arrow; a click makes nothing; resizing across flips it', () => {
	const editor = makeEditor();
	editor.setTool('arrow');
	editor.dispatch(pointer('down', { x: 50, y: 50 }));
	editor.dispatch(pointer('up', { x: 50, y: 50 }));
	assert.equal(editor.getShapes().length, 0);
	assert.equal(editor.tool, 'arrow');

	drag(editor, [100, 100], [300, 200]);
	const [arrow] = editor.getShapes();
	assert.deepEqual(
		[arrow.kind, arrow.x, arrow.y, arrow.props.dx, arrow.props.dy, arrow.props.arrow],
		['line', 100, 100, 200, 100, true]
	);
	assert.equal(editor.tool, 'select');
	assert.equal(editor.getShapeAtPoint({ x: 200, y: 150 })?.id, arrow.id);
	assert.equal(editor.getShapeAtPoint({ x: 280, y: 110 }), undefined);

	// Drag the bottom right corner past the top left: the arrow now points up and left.
	drag(editor, [300, 200], [40, 60]);
	const flipped = editor.getShape(arrow.id)!;
	assert.deepEqual(
		[flipped.x, flipped.y, flipped.props.dx, flipped.props.dy],
		[100, 100, -60, -40]
	);
});

test('shift holds a new line to steps of 15 degrees', () => {
	const editor = makeEditor();
	editor.setTool('line');
	drag(editor, [100, 100], [300, 110], { shift: true });
	const [line] = editor.getShapes();
	assert.ok(Math.abs(line.props.dy) < 1e-9);
	assert.equal(line.props.arrow, false);
});

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
		kind: 'geo',
		x: 400,
		y: 100,
		props: { w: 100, h: 100 },
		style: { fill: 'solid' }
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
