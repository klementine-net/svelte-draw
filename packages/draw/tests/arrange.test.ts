import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pointer } from '../src/lib/index.ts';
import { makeEditor, drag, rect, click } from './helpers.ts';

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
