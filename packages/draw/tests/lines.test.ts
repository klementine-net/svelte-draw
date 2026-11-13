import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lineGeometry, lineEnds, pointer, type LineShape } from '../src/lib/index.ts';
import { makeEditor, drag, near, rect } from './helpers.ts';

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
