import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	BoxTool,
	corePlugins,
	Editor,
	lineGeometry,
	persist,
	GEO_KINDS,
	geoPoints,
	indexBetween,
	lineEnds,
	pointer,
	ShapeUtil,
	Store,
	type Box,
	type Channel,
	type ChannelMessage,
	type DocumentStorage,
	type DrawPlugin,
	type DrawRecord,
	type DrawShape,
	type GeoShape,
	type LineShape,
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

test('arrows attach: the end follows its shape, lets go when moved alone, survives a delete', () => {
	const editor = makeEditor();
	const solid = { fill: 'solid' } as const;
	const a = editor.createShape({
		kind: 'geo',
		x: 100,
		y: 100,
		props: { w: 100, h: 100 },
		style: solid
	});
	const b = editor.createShape({
		kind: 'geo',
		x: 400,
		y: 100,
		props: { w: 100, h: 100 },
		style: solid
	});
	const ends = (id: string) => {
		const shape = editor.getShape<LineShape>(id)!;
		const { start, end } = lineEnds(editor, shape);
		return [start.x + shape.x, start.y + shape.y, end.x + shape.x, end.y + shape.y].map(Math.round);
	};

	// Drawn from inside one shape to inside the other: attached at both ends.
	editor.setTool('arrow');
	drag(editor, [150, 150], [450, 150]);
	const arrow = editor.getShapes().find((shape) => shape.kind === 'line')!;
	assert.deepEqual([arrow.props.start, arrow.props.end], [a.id, b.id]);
	// It runs between the two facing edges (with a small gap), not centre to centre.
	const [x1, y1, x2, y2] = ends(arrow.id);
	assert.ok(x1 > 200 && x1 < 215 && x2 < 400 && x2 > 385, `${x1} ${x2}`);
	assert.deepEqual([y1, y2], [150, 150]);
	assert.equal(editor.hovered.peek(), null);

	// Move the target: the arrow reads differently, and nothing was written to it.
	const before = editor.getShape(arrow.id);
	editor.updateShape(b.id, { y: 400 });
	assert.equal(editor.getShape(arrow.id), before);
	assert.ok(ends(arrow.id)[3] > 390);
	editor.updateShape(b.id, { y: 100 });

	// The one selected line shows its two ends instead of a resize box.
	editor.select([arrow.id]);
	assert.equal(editor.canResizeSelection(), false);
	// (its two ends, and the middle that bends it)
	assert.equal(editor.getShapeHandles()?.handles.length, 3);

	// Drag the end off the shape: it lets go there. Back onto it: attached again.
	drag(editor, [x2, y2], [300, 300]);
	assert.equal(editor.getShape(arrow.id)?.props.end, null);
	assert.deepEqual(ends(arrow.id).slice(2), [300, 300]);
	drag(editor, [300, 300], [450, 150]);
	assert.equal(editor.getShape(arrow.id)?.props.end, b.id);
	// With Ctrl or Command held it stays free, even over a shape.
	editor.undo();
	drag(editor, [300, 300], [450, 150], { meta: true });
	assert.equal(editor.getShape(arrow.id)?.props.end, null);
	editor.undo();
	editor.redo();
	editor.undo();
	editor.redo();
	editor.undo();
	editor.undo();
	assert.equal(editor.getShape(arrow.id)?.props.end, b.id);

	// A copy made alone lets go; a copy made with its shapes is attached to their copies.
	editor.select([arrow.id]);
	editor.duplicateSelection();
	const alone = editor.getShape(editor.selection.peek()[0])!;
	assert.deepEqual([alone.props.start, alone.props.end], [null, null]);
	assert.deepEqual(
		ends(alone.id),
		ends(arrow.id).map((n) => n + 16)
	);
	editor.undo();
	editor.select([a.id, b.id, arrow.id]);
	editor.duplicateSelection();
	const copies = editor.getSelectedShapes();
	const copied = copies.find((shape) => shape.kind === 'line')!;
	assert.notEqual(copied.props.start, a.id);
	assert.ok(copies.some((shape) => shape.id === copied.props.start));
	editor.undo();

	// Moved alone, the arrow lets go of both and moves; moved with its shapes it stays attached.
	editor.select([a.id, b.id, arrow.id]);
	editor.nudgeSelection(0, 10);
	assert.equal(editor.getShape(arrow.id)?.props.start, a.id);
	editor.undo();
	const was = ends(arrow.id);
	editor.select([arrow.id]);
	editor.nudgeSelection(0, 10);
	assert.deepEqual(
		[editor.getShape(arrow.id)?.props.start, editor.getShape(arrow.id)?.props.end],
		[null, null]
	);
	assert.deepEqual(ends(arrow.id), [was[0], was[1] + 10, was[2], was[3] + 10]);
	editor.undo();

	// Deleting a shape leaves the arrow where it showed; undo attaches it again.
	editor.select([b.id]);
	editor.deleteSelection();
	assert.equal(editor.getShape(arrow.id)?.props.end, null);
	assert.deepEqual(ends(arrow.id), was);
	editor.undo();
	assert.equal(editor.getShape(arrow.id)?.props.end, b.id);
	assert.ok(editor.getShape(b.id));
});

test('an arrow attached to an ellipse stops at the curve', () => {
	const editor = makeEditor();
	const circle = editor.createShape({
		kind: 'geo',
		x: 300,
		y: 300,
		props: { geo: 'ellipse', w: 200, h: 200 }
	});
	const arrow = editor.createShape({
		kind: 'line',
		x: 100,
		y: 100,
		props: { dx: 0, dy: 0, arrow: true, end: circle.id }
	});
	const { end } = lineEnds(editor, editor.getShape<LineShape>(arrow.id)!);
	// From the top left towards the centre: on the circle (radius 100, less the gap), not on its box.
	const fromCentre = Math.hypot(end.x + 100 - 400, end.y + 100 - 400);
	assert.ok(fromCentre > 100 && fromCentre < 112, String(fromCentre));
});

const near = (actual: number, expected: number, slack = 0.01) =>
	assert.ok(Math.abs(actual - expected) <= slack, `${actual} is not ${expected}`);
const solid = { fill: 'solid' } as const;
const rect = (editor: Editor, x: number, y: number, w = 100, h = 100) =>
	editor.createShape({ kind: 'geo', x, y, props: { w, h }, style: solid });
const click = (editor: Editor, x: number, y: number, options = {}) => {
	editor.dispatch(pointer('down', { x, y }, options));
	editor.dispatch(pointer('up', { x, y }, options));
};

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

test('turning: the handle turns a shape around its middle; hit, resize and arrows follow', () => {
	const editor = makeEditor();
	const shape = rect(editor, 100, 100, 200, 100);
	editor.select([shape.id]);
	const handle = editor.getRotateHandle()!;
	assert.deepEqual([handle.x, handle.y], [200, 76]);
	// From above the middle to its right: a quarter turn.
	drag(editor, [200, 76], [300, 150]);
	const turned = editor.getShape(shape.id)!;
	near(turned.rotation!, Math.PI / 2);
	const bounds = editor.getShapePageBounds(turned);
	[bounds.x, bounds.y, bounds.w, bounds.h].forEach((n, i) => near(n, [150, 50, 100, 200][i]));
	// What was beside the shape is now outside it, what was above is inside.
	assert.equal(editor.getShapeAtPoint({ x: 110, y: 150 }), undefined);
	assert.equal(editor.getShapeAtPoint({ x: 200, y: 60 })?.id, shape.id);
	// One undo turns it back.
	editor.undo();
	assert.equal(editor.getShape(shape.id)?.rotation ?? 0, 0);
	editor.redo();

	// Its box is turned with it: the "right" edge is now at the bottom. Drag it down by 50.
	assert.equal(editor.getHandleAt({ x: 200, y: 250 }), 'right');
	drag(editor, [200, 250], [200, 300]);
	assert.deepEqual(
		[editor.getShape(shape.id)!.props.w, editor.getShape(shape.id)!.props.h].map(Math.round),
		[250, 100]
	);
	near(editor.getShapePageBounds(editor.getShape(shape.id)!).y, 50);
	near(editor.getShapePageBounds(editor.getShape(shape.id)!).h, 250);

	// Shift turns in steps of 15 degrees.
	const at = editor.getRotateHandle()!;
	drag(editor, [at.x, at.y], [at.x - 7, at.y + 40], { shift: true });
	const steps = editor.getShape(shape.id)!.rotation! / (Math.PI / 12);
	near(steps, Math.round(steps), 1e-6);

	// A line turns by moving its ends: it has no turn of its own.
	const line = editor.createShape({ kind: 'line', x: 500, y: 500, props: { dx: 100, dy: 0 } });
	const other = rect(editor, 500, 600, 100, 100);
	editor.select([line.id, other.id]);
	const top = editor.getRotateHandle()!;
	drag(editor, [top.x, top.y], [top.x + 124, top.y + 124]);
	const moved = editor.getShape(line.id)!;
	assert.equal(moved.rotation ?? 0, 0);
	near(moved.props.dx, 0, 0.5);
	near(moved.props.dy, 100, 0.5);
});

test('groups: picked, moved and resized as one; stepped into by a double click; taken apart', () => {
	const editor = makeEditor();
	const a = rect(editor, 100, 100);
	const b = rect(editor, 300, 100);
	const c = rect(editor, 600, 100);
	editor.history.clear();
	editor.select([a.id, b.id]);
	assert.equal(editor.canGroupSelection(), true);
	editor.dispatch(key('g', { meta: true }));
	const [groupId] = editor.selection.peek();
	const group = editor.getShape(groupId)!;
	assert.equal(group.kind, 'group');
	assert.equal(editor.getShape(a.id)?.parentId, groupId);
	assert.deepEqual(editor.getShapePageBounds(group), { x: 100, y: 100, w: 300, h: 100 });
	// Nothing moved on the page.
	assert.deepEqual(editor.getShapePageOrigin(editor.getShape(b.id)!), { x: 300, y: 100 });

	// A click on one of them picks the group; a drag moves both.
	editor.select([]);
	click(editor, 150, 150);
	assert.deepEqual(editor.selection.peek(), [groupId]);
	drag(editor, [150, 150], [150, 350]);
	assert.deepEqual(editor.getShapePageOrigin(editor.getShape(b.id)!), { x: 300, y: 300 });
	// Resizing the group resizes what is in it.
	drag(editor, [400, 400], [700, 500]);
	assert.deepEqual(editor.getShapePageBounds(editor.getShape(b.id)!), {
		x: 500,
		y: 300,
		w: 200,
		h: 200
	});
	assert.deepEqual(editor.getShapePageBounds(editor.getShape(a.id)!), {
		x: 100,
		y: 300,
		w: 200,
		h: 200
	});

	// A double click steps in: now a click picks the one shape. Escape steps out again.
	editor.dispatch({ ...pointer('down', { x: 150, y: 350 }), type: 'double_click' });
	assert.equal(editor.focusedGroup.peek(), groupId);
	assert.deepEqual(editor.selection.peek(), [a.id]);
	editor.dispatch(key('Escape'));
	assert.deepEqual([editor.focusedGroup.peek(), editor.selection.peek()], [null, [groupId]]);

	// A marquee over one of them takes the group; select all counts it once.
	editor.selectAll();
	assert.deepEqual([...editor.selection.peek()].sort(), [groupId, c.id].sort());

	// Turned, then taken apart: each shape stays where it shows, turned.
	editor.select([groupId]);
	const before = editor.getShapePageBounds(editor.getShape(b.id)!);
	const handle = editor.getRotateHandle()!;
	drag(editor, [handle.x, handle.y], [handle.x + 100, handle.y + 60]);
	const turnedBounds = editor.getShapePageBounds(editor.getShape(b.id)!);
	assert.notDeepEqual(turnedBounds, before);
	editor.dispatch(key('G', { meta: true, shift: true }));
	assert.equal(editor.getShape(groupId), undefined);
	assert.deepEqual([...editor.selection.peek()].sort(), [a.id, b.id].sort());
	const after = editor.getShapePageBounds(editor.getShape(b.id)!);
	[after.x, after.y, after.w, after.h].forEach((n, i) =>
		near(n, [turnedBounds.x, turnedBounds.y, turnedBounds.w, turnedBounds.h][i])
	);
	assert.equal(editor.getShape(b.id)?.parentId, editor.pageId.peek());
	// Grouping, moving, resizing, turning and ungrouping each undo on their own.
	for (let i = 0; i < 5; i++) editor.undo();
	assert.deepEqual(editor.getShapePageBounds(editor.getShape(b.id)!), {
		x: 300,
		y: 100,
		w: 100,
		h: 100
	});
	assert.equal(editor.getShape(groupId), undefined);
});

test('frames take in what is dropped on them, move it with them, and cut it off', () => {
	const editor = makeEditor();
	editor.setTool('frame');
	drag(editor, [100, 100], [500, 400]);
	const frame = editor.getShapes()[0];
	assert.equal(frame.kind, 'frame');
	assert.equal(editor.editing.peek(), null);
	const shape = rect(editor, 600, 150);
	editor.history.clear();

	// Dropped on the frame: it is the frame's now, and still where it was dropped.
	editor.select([shape.id]);
	drag(editor, [650, 200], [350, 200]);
	assert.equal(editor.getShape(shape.id)?.parentId, frame.id);
	assert.deepEqual(editor.getShapePageOrigin(editor.getShape(shape.id)!), { x: 300, y: 150 });
	// Above the frame in the pile, so a click finds it and not the frame.
	click(editor, 350, 200);
	assert.deepEqual(editor.selection.peek(), [shape.id]);

	// The frame is picked by its edge or its name; dragged by its name, it moves what is in it.
	click(editor, 100, 250);
	assert.deepEqual(editor.selection.peek(), [frame.id]);
	drag(editor, [150, 90], [150, 190]);
	assert.deepEqual(editor.getShapePageOrigin(editor.getShape(shape.id)!), { x: 300, y: 250 });

	// Half out of the frame: the part outside is cut off, so it is not hit there.
	editor.updateShape(shape.id, { x: 350 });
	assert.equal(editor.getShapeAtPoint({ x: 480, y: 300 })?.id, shape.id);
	assert.equal(editor.getShapeAtPoint({ x: 530, y: 300 }), undefined);

	// Dragged out again: the page's. A new shape drawn inside is the frame's from the start.
	editor.select([shape.id]);
	drag(editor, [480, 300], [780, 300]);
	assert.equal(editor.getShape(shape.id)?.parentId, editor.pageId.peek());
	editor.setTool('rectangle');
	drag(editor, [150, 250], [250, 350]);
	assert.equal(editor.getSelectedShapes()[0].parentId, frame.id);
	// A marquee drawn inside the frame takes what is in it, not the frame; around it, both.
	editor.setTool('select');
	drag(editor, [120, 220], [300, 400]);
	assert.deepEqual(
		editor.getSelectedShapes().map((s) => s.kind),
		['geo']
	);
	drag(editor, [50, 150], [600, 560]);
	assert.ok(editor.selection.peek().includes(frame.id));
	// Deleting the frame deletes what is in it.
	editor.select([frame.id]);
	editor.deleteSelection();
	assert.deepEqual(
		editor.getShapes().map((s) => s.id),
		[shape.id]
	);
});

test('clipboard: copy and paste at a point, cut, and Alt-drag leaves a copy behind', () => {
	const editor = makeEditor();
	const a = rect(editor, 100, 100);
	const b = rect(editor, 300, 100);
	const arrow = editor.createShape({
		kind: 'line',
		x: 0,
		y: 0,
		props: { arrow: true, start: a.id, end: b.id }
	});
	editor.history.clear();
	editor.select([a.id, b.id, arrow.id]);
	const content = JSON.parse(JSON.stringify(editor.copy()));
	assert.equal(content.length, 3);
	editor.paste(content, { x: 250, y: 600 });
	const pasted = editor.getSelectedShapes();
	assert.equal(pasted.length, 3);
	assert.deepEqual(editor.getSelectionBounds(), { x: 100, y: 550, w: 300, h: 100 });
	// The pasted arrow is attached to the pasted shapes.
	const copy = pasted.find((shape) => shape.kind === 'line')!;
	assert.ok(pasted.some((shape) => shape.id === copy.props.start && shape.id !== a.id));
	editor.undo();
	assert.equal(editor.getShapes().length, 3);

	editor.select([a.id]);
	editor.cut();
	assert.equal(editor.getShape(a.id), undefined);
	assert.equal(editor.getShape(arrow.id)?.props.start, null);
	editor.undo();
	assert.equal(editor.getShape(arrow.id)?.props.start, a.id);

	// Alt held while dragging: the shape stays, a copy moves, and it is one undo step.
	editor.select([b.id]);
	drag(editor, [350, 150], [350, 350], { alt: true });
	assert.deepEqual(editor.getShapePageOrigin(editor.getShape(b.id)!), { x: 300, y: 100 });
	assert.deepEqual(editor.getShapePageOrigin(editor.getSelectedShapes()[0]), { x: 300, y: 300 });
	assert.equal(editor.getShapes().length, 4);
	editor.undo();
	assert.equal(editor.getShapes().length, 3);
});

test('arrange: align, space evenly, flip, one step in the pile, lock', () => {
	const editor = makeEditor();
	const a = rect(editor, 100, 100, 50, 50);
	const b = rect(editor, 300, 180, 100, 100);
	const c = rect(editor, 700, 120, 60, 60);
	const xs = () => [a, b, c].map((shape) => editor.getShape(shape.id)!.x);
	const ys = () => [a, b, c].map((shape) => editor.getShape(shape.id)!.y);
	editor.selectAll();
	editor.alignSelection('top');
	assert.deepEqual(ys(), [100, 100, 100]);
	editor.alignSelection('middle');
	assert.deepEqual(ys(), [125, 100, 120]);
	editor.distributeSelection('x');
	// 660 wide, 210 taken: two gaps of 225.
	assert.deepEqual(xs(), [100, 375, 700]);
	editor.flipSelection('x');
	assert.deepEqual(xs(), [710, 385, 100]);

	// One step: a goes above b, not above c.
	const order = () => editor.getShapes().map((shape) => shape.id);
	assert.deepEqual(order(), [a.id, b.id, c.id]);
	editor.bringForward([a.id]);
	assert.deepEqual(order(), [b.id, a.id, c.id]);
	editor.sendBackward([c.id]);
	assert.deepEqual(order(), [b.id, c.id, a.id]);

	// A locked shape is not picked by a click, a marquee or select all, and not erased.
	editor.select([b.id]);
	editor.toggleLock();
	assert.deepEqual(editor.selection.peek(), []);
	click(editor, 400, 150);
	assert.deepEqual(editor.selection.peek(), []);
	editor.selectAll();
	assert.deepEqual([...editor.selection.peek()].sort(), [a.id, c.id].sort());
	// Picked on purpose (the right-click menu does this), it still does not move or go away.
	editor.select([b.id]);
	editor.nudgeSelection(10, 0);
	editor.deleteSelection();
	assert.equal(editor.getShape(b.id)?.x, 385);
	editor.toggleLock();
	assert.equal(editor.getShape(b.id)?.locked, false);
});

test('snapping: a moved shape catches on another shape\u2019s edge; Ctrl or Command lets it pass', () => {
	const editor = makeEditor();
	const still = rect(editor, 100, 100);
	const moving = rect(editor, 400, 300);
	editor.select([moving.id]);
	// Dragged so its left edge is 3 px off the other's right edge: it lands on it.
	editor.dispatch(pointer('down', { x: 450, y: 350 }));
	editor.dispatch(pointer('move', { x: 300, y: 350 }));
	editor.dispatch(pointer('move', { x: 253, y: 350 }));
	assert.equal(editor.getShape(moving.id)?.x, 200);
	assert.equal(editor.snapLines.peek().length, 1);
	editor.dispatch(pointer('move', { x: 253, y: 350 }, { meta: true }));
	assert.equal(editor.getShape(moving.id)?.x, 203);
	editor.dispatch(pointer('up', { x: 253, y: 350 }, { meta: true }));
	assert.deepEqual(editor.snapLines.peek(), []);
	assert.ok(still);
});

test('an arrow to a shape in a group stays attached when it moves with the group', () => {
	const editor = makeEditor();
	const a = rect(editor, 100, 100);
	const b = rect(editor, 300, 100);
	editor.select([a.id, b.id]);
	editor.groupSelection();
	const [groupId] = editor.selection.peek();
	const arrow = editor.createShape({
		kind: 'line',
		x: 600,
		y: 600,
		props: { arrow: true, end: b.id }
	});
	editor.select([groupId, arrow.id]);
	editor.nudgeSelection(0, 10);
	assert.equal(editor.getShape(arrow.id)?.props.end, b.id);
	// Moved without the group, it lets go.
	editor.select([arrow.id]);
	editor.nudgeSelection(0, 10);
	assert.equal(editor.getShape(arrow.id)?.props.end, null);
});

/** Storage and a pair of channels that live in memory, standing in for IndexedDB and tabs. */
function fakeStorage() {
	const records = new Map<string, DrawRecord>();
	let version: number | undefined;
	const storage: DocumentStorage = {
		load: async () =>
			records.size > 0 ? { version: version ?? 1, records: [...records.values()] } : undefined,
		save: async (change) => {
			version = change.version;
			for (const record of change.put) records.set(record.id, record);
			for (const id of change.remove) records.delete(id);
		}
	};
	return { storage, records };
}
function fakeChannels(): [Channel, Channel] {
	const listeners: ((message: ChannelMessage) => void)[][] = [[], []];
	const end = (mine: number): Channel => ({
		// A message goes to the other end, never back to the sender.
		post: (message) =>
			listeners[1 - mine].forEach((listener) => listener(structuredClone(message))),
		listen(listener) {
			listeners[mine].push(listener);
			return () => listeners[mine].splice(listeners[mine].indexOf(listener), 1);
		}
	});
	return [end(0), end(1)];
}

test('saving: a board is seeded once, kept record by record, loaded again; tabs stay in step', async () => {
	const { storage, records } = fakeStorage();
	const [one, two] = fakeChannels();
	const seed = (editor: Editor) => void rect(editor, 100, 100);

	const first = makeEditor();
	await persist(first, { storage, channel: one, seed });
	assert.equal(first.getShapes().length, 1);
	// The seed is not an undo step, and it is saved with the page.
	assert.equal(first.history.canUndo.peek(), false);
	assert.equal(records.size, 2);

	// A second tab loads what is there and is not seeded again.
	const second = makeEditor();
	await persist(second, { storage, channel: two, seed });
	assert.equal(second.getShapes().length, 1);
	assert.equal(second.history.canUndo.peek(), false);

	// What one draws, the other sees, and it is saved; the other cannot undo it.
	const shape = rect(first, 300, 300);
	assert.equal(second.getShape(shape.id)?.x, 300);
	assert.equal(second.history.canUndo.peek(), false);
	assert.ok(records.has(shape.id));
	second.updateShape(shape.id, { x: 500 });
	assert.equal(first.getShape(shape.id)?.x, 500);
	assert.equal((records.get(shape.id) as ShapeRecord).x, 500);
	first.history.mark();
	first.deleteShapes([shape.id]);
	assert.equal(second.getShape(shape.id), undefined);
	assert.equal(records.has(shape.id), false);
	first.undo();
	assert.ok(second.getShape(shape.id));

	// A shape of a kind this app does not know is kept and left out, not a crash.
	await storage.save({
		version: 1,
		put: [{ ...(first.getShape(shape.id) as ShapeRecord), id: 'shape:alien', kind: 'hologram' }],
		remove: []
	});
	const third = makeEditor();
	await persist(third, { storage });
	assert.equal(
		third.getShapes().some((s) => s.id === 'shape:alien'),
		false
	);
	assert.ok(third.store.has('shape:alien'));
});

test('pages: each has its own shapes and view; deleting one takes its shapes; the last stays', () => {
	const editor = makeEditor();
	const [firstPage] = editor.getPages();
	const a = rect(editor, 100, 100);
	editor.select([a.id]);
	editor.pan(-50, 0);
	const second = editor.createPage();
	assert.deepEqual(
		editor.getPages().map((page) => page.name),
		['Page 1', 'Page 2']
	);
	// The new page is empty, nothing is selected, and its view starts fresh.
	assert.deepEqual([editor.getShapes().length, editor.selection.peek().length], [0, 0]);
	assert.equal(editor.camera.peek().x, 0);
	const b = rect(editor, 200, 200);
	assert.equal(b.parentId, second.id);
	editor.setPage(firstPage.id);
	assert.deepEqual(
		editor.getShapes().map((shape) => shape.id),
		[a.id]
	);
	assert.equal(editor.camera.peek().x, -50);
	editor.renamePage(second.id, 'Ideas');
	assert.equal(editor.getPages()[1].name, 'Ideas');

	// Deleting the page being looked at moves to another and takes its shapes along.
	editor.setPage(second.id);
	editor.deletePage(second.id);
	assert.equal(editor.pageId.peek(), firstPage.id);
	assert.equal(editor.store.has(b.id), false);
	editor.undo();
	assert.ok(editor.store.has(b.id));
	assert.equal(editor.getPages().length, 2);
	editor.redo();
	// The last page cannot be deleted.
	editor.deletePage(firstPage.id);
	assert.equal(editor.getPages().length, 1);

	// A saved document loads into another editor.
	const copy = makeEditor();
	copy.loadDocument(JSON.parse(JSON.stringify(editor.getDocument().records)));
	assert.deepEqual(
		copy.getShapes().map((shape) => shape.id),
		[a.id]
	);
	assert.equal(copy.history.canUndo.peek(), false);
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

test('a line bends by its middle handle; hit test and box follow the curve; near straight snaps back', () => {
	const editor = makeEditor();
	const line = editor.createShape({
		kind: 'line',
		x: 100,
		y: 300,
		props: { dx: 200, dy: 0, arrow: true }
	});
	editor.select([line.id]);
	// Drag the middle up by 80.
	drag(editor, [200, 300], [200, 220]);
	const bent = editor.getShape<LineShape>(line.id)!;
	near(bent.props.bend!, -80, 0.5);
	const { middle, control } = lineGeometry(editor, bent);
	near(middle.y + bent.y, 220, 0.5);
	assert.ok(control);
	// The curve is hit where it runs, not where the straight line was.
	assert.equal(editor.getShapeAtPoint({ x: 200, y: 222 })?.id, line.id);
	assert.equal(editor.getShapeAtPoint({ x: 200, y: 300 }), undefined);
	near(editor.getShapePageBounds(bent).y, 220, 1);
	// Dragged back to within a few pixels of straight: straight.
	drag(editor, [200, 220], [200, 297]);
	assert.equal(editor.getShape(line.id)?.props.bend, 0);
});

test('presence: tabs see each other\u2019s pointer and selection, and a tab that leaves is gone', async () => {
	const [one, two] = fakeChannels();
	const first = makeEditor();
	const second = makeEditor();
	const stopFirst = await persist(first, { channel: one, user: { name: 'Ada' } });
	await persist(second, { channel: two, user: { name: 'Grace' } });
	const shape = rect(first, 100, 100);
	first.select([shape.id]);
	first.dispatch(pointer('move', { x: 140, y: 160 }));
	await new Promise((resolve) => setTimeout(resolve, 80));
	const [ada] = second.peers.peek();
	assert.deepEqual([ada.name, ada.cursor, ada.selection], ['Ada', { x: 140, y: 160 }, [shape.id]]);
	// The newcomer was told about the one already there, too.
	assert.deepEqual(
		first.peers.peek().map((peer) => peer.name),
		['Grace']
	);
	// Nothing of this is in the document or the undo history.
	assert.equal(second.history.canUndo.peek(), false);
	stopFirst();
	assert.deepEqual(second.peers.peek(), []);
});

test('more ways in and around: links, lasso, zoom tool, laser, grid, frames in frames', () => {
	const editor = makeEditor();
	// A pasted web address is a link (a player for a video); any other text is a text.
	editor.pasteText('https://www.youtube.com/watch?v=dQw4w9WgXcQ', { x: 500, y: 300 });
	editor.pasteText('https://example.com/a/page', { x: 500, y: 600 });
	editor.pasteText('just words', { x: 100, y: 700 });
	assert.deepEqual(
		editor.getShapes().map((shape) => [shape.kind, shape.props.w]),
		[
			['link', 480],
			['link', 320],
			['text', 8]
		]
	);
	editor.deleteShapes(editor.getShapes().map((shape) => shape.id));

	// Alt-drag from the canvas draws a lasso: what the line crosses is picked.
	const a = rect(editor, 100, 100);
	const b = rect(editor, 300, 100);
	const c = rect(editor, 100, 400);
	editor.setTool('select');
	drag(editor, [50, 150], [450, 150], { alt: true });
	assert.deepEqual([...editor.selection.peek()].sort(), [a.id, b.id].sort());
	assert.deepEqual(editor.lasso.peek(), []);
	assert.ok(c);

	// The zoom tool: a drag zooms to the box, a click zooms in; then it hands back to select.
	editor.setTool('zoom');
	drag(editor, [100, 100], [300, 260]);
	assert.equal(editor.tool, 'select');
	assert.equal(editor.camera.peek().z, 5);
	editor.resetZoom();
	editor.camera.set({ x: 0, y: 0, z: 1 });

	// The laser leaves a trail and nothing in the document.
	editor.history.clear();
	editor.setTool('laser');
	editor.dispatch(pointer('down', { x: 10, y: 10 }));
	editor.dispatch(pointer('move', { x: 60, y: 40 }));
	assert.equal(editor.laser.peek().length, 2);
	editor.dispatch(pointer('up', { x: 60, y: 40 }));
	assert.equal(editor.history.canUndo.peek(), false);

	// With the grid's snap on, a moved shape lands on a grid line.
	editor.setTool('select');
	editor.grid.set({ show: true, snap: true });
	editor.select([c.id]);
	drag(editor, [150, 450], [557, 631]);
	assert.deepEqual([editor.getShape(c.id)!.x % 24, editor.getShape(c.id)!.y % 24], [0, 0]);
	editor.grid.set({ show: true, snap: false });

	// A frame dropped on a larger frame becomes its child.
	const outer = editor.createShape({ kind: 'frame', x: 600, y: 300, props: { w: 380, h: 400 } });
	const inner = editor.createShape({ kind: 'frame', x: 0, y: 0, props: { w: 120, h: 100 } });
	editor.settle([inner.id]);
	assert.equal(editor.getShape(inner.id)?.parentId, editor.pageId.peek());
	editor.updateShape(inner.id, { x: 700, y: 400 });
	editor.settle([inner.id, outer.id]);
	assert.equal(editor.getShape(inner.id)?.parentId, outer.id);
	assert.equal(editor.getShape(outer.id)?.parentId, editor.pageId.peek());
});

test('a drag held at the edge of the canvas moves the view, and the shape with it', async () => {
	const editor = makeEditor();
	const shape = rect(editor, 400, 300);
	editor.select([shape.id]);
	editor.dispatch(pointer('down', { x: 450, y: 350 }));
	editor.dispatch(pointer('move', { x: 700, y: 350 }));
	// At the right edge: held there, the view keeps moving left and the shape keeps going right.
	editor.dispatch(pointer('move', { x: 995, y: 350 }));
	const before = editor.getShape(shape.id)!.x;
	await new Promise((resolve) => setTimeout(resolve, 120));
	assert.ok(editor.camera.peek().x < 0);
	assert.ok(editor.getShape(shape.id)!.x > before);
	// Released: it stops.
	editor.dispatch(pointer('up', { x: 995, y: 350 }));
	const camera = editor.camera.peek().x;
	await new Promise((resolve) => setTimeout(resolve, 60));
	assert.equal(editor.camera.peek().x, camera);
});

test('a right-angled arrow leaves each shape straight out of its side', () => {
	const editor = makeEditor();
	const a = rect(editor, 100, 100);
	const b = rect(editor, 500, 300);
	const arrow = editor.createShape({
		kind: 'line',
		x: 0,
		y: 0,
		props: { arrow: true, elbow: true, start: a.id, end: b.id }
	});
	const line = editor.getShape<LineShape>(arrow.id)!;
	const { points, from } = lineGeometry(editor, line);
	assert.equal(points.length, 4);
	// Out of the first shape's right side at its middle height, into the second's left side.
	near(points[0].y, 150, 0.01);
	assert.ok(points[0].x > 200 && points[0].x < 215);
	near(points[3].y, 350, 0.01);
	assert.ok(points[3].x < 500 && points[3].x > 485);
	// Every stretch runs along one axis, and the head comes in level.
	for (let i = 1; i < points.length; i++)
		assert.ok(points[i].x === points[i - 1].x || points[i].y === points[i - 1].y);
	near(from.end.y, 350, 0.01);
	// Only its two ends can be dragged; the switch in the menu turns it straight again.
	editor.select([arrow.id]);
	assert.equal(editor.getShapeHandles()?.handles.length, 2);
	editor.toggleSelection('elbow');
	assert.equal(lineGeometry(editor, editor.getShape<LineShape>(arrow.id)!).points.length, 2);
});

test('a file opened over a board with the same records keeps every record in storage and in other tabs', async () => {
	const { storage, records } = fakeStorage();
	const [one, two] = fakeChannels();
	const first = makeEditor();
	const second = makeEditor();
	await persist(first, { storage, channel: one, seed: (editor) => void rect(editor, 100, 100) });
	await persist(second, { storage, channel: two });
	const file = JSON.parse(JSON.stringify(first.getDocument().records)) as DrawRecord[];
	const extra = rect(first, 300, 300);
	// Opening the file replaces the board: the page and the first shape keep their ids.
	first.loadDocument(file, 'user');
	assert.equal(first.getShapes().length, 1);
	assert.deepEqual([...records.keys()].sort(), file.map((record) => record.id).sort());
	assert.deepEqual(
		second.store
			.snapshot()
			.map((record) => record.id)
			.sort(),
		file.map((record) => record.id).sort()
	);
	assert.equal(second.getShape(extra.id), undefined);
	assert.equal(second.getShapes().length, 1);

	// With a delay, the changes of a drag are written once, with the last state.
	const slow = fakeStorage();
	let saves = 0;
	const counted: DocumentStorage = {
		load: slow.storage.load,
		save: (change) => (saves++, slow.storage.save(change))
	};
	const third = makeEditor();
	const stop = await persist(third, { storage: counted, saveDelay: 20 });
	saves = 0;
	const shape = rect(third, 0, 0);
	for (let x = 1; x <= 5; x++) third.updateShape(shape.id, { x });
	assert.equal(saves, 0);
	await new Promise((resolve) => setTimeout(resolve, 60));
	assert.equal(saves, 1);
	assert.equal((slow.records.get(shape.id) as ShapeRecord).x, 5);
	// Stopping writes what was still waiting.
	third.updateShape(shape.id, { x: 9 });
	stop();
	assert.equal((slow.records.get(shape.id) as ShapeRecord).x, 9);
});

test('storage that fails or never answers does not leave a dead board', async () => {
	const seed = (editor: Editor) => void rect(editor, 100, 100);
	const warn = console.warn;
	console.warn = () => {};
	try {
		// It throws: the board is seeded and works, nothing is kept.
		const broken: DocumentStorage = {
			load: async () => {
				throw new Error('no storage here');
			},
			save: async () => {
				throw new Error('no storage here');
			}
		};
		const first = makeEditor();
		await persist(first, { storage: broken, seed });
		assert.equal(first.getShapes().length, 1);
		rect(first, 300, 300);
		assert.equal(first.getShapes().length, 2);

		// It never answers: after the wait, the same.
		const silent: DocumentStorage = { load: () => new Promise(() => {}), save: async () => {} };
		const second = makeEditor();
		await persist(second, { storage: silent, seed, loadTimeout: 20 });
		assert.equal(second.getShapes().length, 1);

		// A save that fails later is a warning, not a crash.
		const { storage } = fakeStorage();
		const flaky: DocumentStorage = {
			load: storage.load,
			save: async () => {
				throw new Error('disk full');
			}
		};
		const third = makeEditor();
		await persist(third, { storage: flaky, seed });
		rect(third, 300, 300);
		await new Promise((resolve) => setTimeout(resolve, 10));
		assert.equal(third.getShapes().length, 2);
	} finally {
		console.warn = warn;
	}
});
