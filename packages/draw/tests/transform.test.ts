import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pointer } from '../src/lib/core.ts';
import { makeEditor, drag, key, near, rect, click } from './helpers.ts';

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
