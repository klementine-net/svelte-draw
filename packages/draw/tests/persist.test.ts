import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	Editor,
	persist,
	pointer,
	type DocumentStorage,
	type DrawRecord,
	type ShapeRecord
} from '../src/lib/core.ts';
import { makeEditor, rect, fakeStorage, fakeChannels } from './helpers.ts';

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
