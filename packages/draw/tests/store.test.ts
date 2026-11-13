import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	corePlugins,
	indexBetween,
	Store,
	type DrawRecord,
	type ShapeRecord
} from '../src/lib/index.ts';
import { makeEditor, byId } from './helpers.ts';

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
