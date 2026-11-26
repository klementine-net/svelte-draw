/*
 * What only a browser can do (`pnpm test:browser`): pictures, the minimap, links to a view, not
 * drawing what is off screen, the clipboard, dropped files, saving to a file, IndexedDB and the
 * line between tabs. Each test uses the real thing: a canvas element, a clipboard event, a
 * database.
 */

import { expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';
import {
	broadcastChannel,
	Editor,
	indexedDbStorage,
	persist,
	type AssetRecord,
	type ChannelMessage,
	type DocumentFile
} from '../../src/lib/index.ts';
import { deepLink, defaultPlugins, saveFile, toPng, toSvg } from '../../src/lib/svelte/index.ts';
import Board from './board.svelte';

const board = async (props: { minimap?: boolean; scheme?: 'light' | 'dark' } = {}) => {
	const editor = new Editor({ plugins: defaultPlugins });
	const screen = await render(Board, { editor, ...props });
	const root = () => screen.container.querySelector<HTMLElement>('.kd-root')!;
	const surface = () => screen.container.querySelector<HTMLElement>('.kd-surface')!;
	const drawn = () => screen.container.querySelectorAll('.kd-shape').length;
	return { editor, screen, root, surface, drawn };
};
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
/** A name no other test (or an earlier run) has used. */
const fresh = (name: string) => `test-${name}-${Math.random().toString(36).slice(2)}`;

/** A picture's pixels, to look at single ones: `[red, green, blue, alpha]` at a point. */
async function pixels(blob: Blob) {
	const bitmap = await createImageBitmap(blob);
	const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
	const context = canvas.getContext('2d')!;
	context.drawImage(bitmap, 0, 0);
	const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height);
	return {
		width: bitmap.width,
		height: bitmap.height,
		at: (x: number, y: number) => [
			...data.slice((y * bitmap.width + x) * 4, (y * bitmap.width + x) * 4 + 4)
		]
	};
}

/** A colour as the browser paints it: `[red, green, blue]`, whatever notation it is written in. */
function painted(colour: string) {
	const context = new OffscreenCanvas(1, 1).getContext('2d')!;
	context.fillStyle = colour;
	context.fillRect(0, 0, 1, 1);
	return [...context.getImageData(0, 0, 1, 1).data.slice(0, 3)];
}
/** The fill of the first shape as it is on screen. */
const fillOnScreen = (root: HTMLElement) =>
	painted(getComputedStyle(root.querySelector('.kd-shape .kd-fill')!).fill);
const near = (a: number[], b: number[]) => a.every((value, i) => Math.abs(value - b[i]) <= 3);

/** A small real picture file: a square of one colour. */
async function pictureFile(name = 'square.png') {
	const canvas = new OffscreenCanvas(40, 30);
	const context = canvas.getContext('2d')!;
	context.fillStyle = '#2f6bd8';
	context.fillRect(0, 0, 40, 30);
	return new File([await canvas.convertToBlob({ type: 'image/png' })], name, { type: 'image/png' });
}

test('a picture of the page: its size, its ground and its shapes, in their colours', async () => {
	const { editor, root, drawn } = await board();
	editor.createShape({
		kind: 'geo',
		x: 100,
		y: 100,
		props: { w: 200, h: 100 },
		style: { color: 'red', fill: 'solid', look: 'precise' }
	});
	await expect.poll(drawn).toBe(1);

	const picture = (await toSvg(editor, root()))!;
	// The shapes' bounds and 32 of air on every side.
	expect([picture.width, picture.height]).toEqual([264, 164]);
	expect(picture.svg).toContain('<foreignObject');
	expect(picture.svg).toContain('kd-shape');
	// The canvas's own colours travel with the picture: it is drawn outside the page.
	expect(picture.svg).toMatch(/--kd-ground:\s*#f5f3ee/);
	expect(picture.svg).toMatch(/--kd-red:\s*#cf3f3f/);

	const png = (await toPng(editor, root()))!;
	expect(png.type).toBe('image/png');
	const image = await pixels(png);
	// Twice the size, for sharp screens.
	expect([image.width, image.height]).toEqual([528, 328]);
	expect(image.at(8, 8)).toEqual([245, 243, 238, 255]);
	// The shape is in the picture as it is on screen: the same red, not the ground's colour.
	const [red, green, blue, alpha] = image.at(264, 164);
	const onScreen = fillOnScreen(root());
	expect(alpha).toBe(255);
	expect(near([red, green, blue], onScreen), `${[red, green, blue]} is not ${onScreen}`).toBe(true);
	expect(red - green).toBeGreaterThan(50);
});

test('a picture in the dark scheme, without a ground, of chosen shapes, at another size', async () => {
	const { editor, root, drawn } = await board({ scheme: 'dark' });
	const one = editor.createShape({
		kind: 'geo',
		x: 0,
		y: 0,
		props: { w: 100, h: 100 },
		style: { fill: 'solid', look: 'precise' }
	});
	editor.createShape({ kind: 'geo', x: 400, y: 300, props: { w: 100, h: 100 } });
	await expect.poll(drawn).toBe(2);

	const dark = await pixels((await toPng(editor, root(), { scale: 1 }))!);
	expect([dark.width, dark.height]).toEqual([564, 464]);
	expect(dark.at(4, 4)).toEqual([27, 25, 22, 255]);
	// Ink is light on a dark ground, and the same as on screen.
	const ink = dark.at(82, 82).slice(0, 3);
	expect(near(ink, fillOnScreen(root())), `${ink} is not ${fillOnScreen(root())}`).toBe(true);
	expect(ink[0]).toBeGreaterThan(100);

	const chosen = await pixels(
		(await toPng(editor, root(), { ids: [one.id], padding: 10, background: false, scale: 1 }))!
	);
	expect([chosen.width, chosen.height]).toEqual([120, 120]);
	expect(chosen.at(2, 2)[3]).toBe(0);
	expect(chosen.at(60, 60)[3]).toBe(255);
	// Everything is on screen again afterwards.
	expect(drawn()).toBe(2);
});

test('nothing to draw makes no picture', async () => {
	const { editor, root } = await board();
	expect(await toSvg(editor, root())).toBeUndefined();
	expect(await toPng(editor, root())).toBeUndefined();
});

test('the minimap shows every shape and goes where it is pressed', async () => {
	const { editor, screen } = await board({ minimap: true });
	editor.createShape({
		kind: 'geo',
		x: 0,
		y: 0,
		props: { w: 100, h: 100 },
		style: { color: 'red' }
	});
	editor.createShape({ kind: 'note', x: 3000, y: 2000 });
	const map = () => screen.container.querySelector<SVGSVGElement>('.kd-minimap')!;
	await expect.poll(() => map().querySelectorAll('.kd-minimap-shape').length).toBe(2);
	expect(map().querySelector('.kd-minimap-shape')!.getAttribute('data-color')).toBe('red');
	expect(map().getAttribute('aria-label')).toBe('Map of the page');

	// Its bottom right corner is the far note: pressing there brings the note on screen.
	const box = map().getBoundingClientRect();
	map().dispatchEvent(
		new PointerEvent('pointerdown', {
			pointerId: 1,
			clientX: box.right - 12,
			clientY: box.bottom - 12,
			bubbles: true
		})
	);
	const view = editor.getViewportPageBounds();
	expect(view.x + view.w).toBeGreaterThan(3000);
	expect(view.y + view.h).toBeGreaterThan(2000);
	await expect.poll(() => screen.container.querySelector('.note')).toBeTruthy();
});

test('what is off screen is not drawn, until the view gets there', async () => {
	const { editor, drawn } = await board();
	editor.createShape({ kind: 'geo', x: 100, y: 100, props: { w: 100, h: 100 } });
	const far = editor.createShape({ kind: 'geo', x: 5000, y: 100, props: { w: 100, h: 100 } });
	await expect.poll(drawn).toBe(1);
	expect(editor.getShapes().length).toBe(2);

	// What is selected stays drawn wherever it is: its handles have to be there.
	editor.select([far.id]);
	await expect.poll(drawn).toBe(2);
	editor.select([]);
	await expect.poll(drawn).toBe(1);

	editor.camera.set({ x: -4800, y: 0, z: 1 });
	await expect.poll(drawn).toBe(1);
	expect(document.querySelector(`.kd-shape[data-id="${far.id}"]`)).toBeTruthy();
});

test('the address keeps the page and the view, and a pasted address opens there', async () => {
	const { editor } = await board();
	const before = location.hash;
	const stop = deepLink(editor);
	try {
		editor.camera.set({ x: -120, y: 80, z: 1.5 });
		await expect.poll(() => location.hash, { timeout: 2000 }).toContain('view=-120%2C80%2C1.5');
		expect(location.hash).toContain(`page=${encodeURIComponent(editor.pageId.get())}`);

		location.hash = `#page=${encodeURIComponent(editor.pageId.get())}&view=300,-40,0.5`;
		await expect.poll(() => editor.camera.get()).toEqual({ x: 300, y: -40, z: 0.5 });

		// A broken address moves nothing.
		location.hash = '#view=1,2,nonsense';
		await wait(100);
		expect(editor.camera.get()).toEqual({ x: 300, y: -40, z: 0.5 });
	} finally {
		stop();
		history.replaceState(history.state, '', before || location.pathname + location.search);
	}
	// Stopped: the view moves, the address stays.
	const kept = location.hash;
	editor.camera.set({ x: 0, y: 0, z: 1 });
	await wait(450);
	expect(location.hash).toBe(kept);
});

test('copy and paste go through the clipboard, cut takes the shape away', async () => {
	const { editor, surface } = await board();
	const shape = editor.createShape({
		kind: 'note',
		x: 100,
		y: 100,
		props: { text: 'Copied words' }
	});
	editor.select([shape.id]);
	const clipboard = new DataTransfer();
	const send = (type: 'copy' | 'cut' | 'paste', data = clipboard) =>
		surface().dispatchEvent(
			new ClipboardEvent(type, { clipboardData: data, bubbles: true, cancelable: true })
		);

	send('copy');
	expect(clipboard.getData('text/plain')).toBe('Copied words');
	expect(clipboard.types).toContain('application/x-svelte-draw');
	send('paste');
	expect(editor.getShapes().length).toBe(2);
	expect(editor.getShapes().every((each) => each.props.text === 'Copied words')).toBe(true);

	editor.select([shape.id]);
	send('cut');
	expect(editor.getShape(shape.id)).toBeUndefined();
	expect(editor.getShapes().length).toBe(1);

	// Words from another app become a text; a web address becomes a link.
	const words = new DataTransfer();
	words.setData('text/plain', 'Typed somewhere else');
	send('paste', words);
	expect(editor.getShapes().some((each) => each.props.text === 'Typed somewhere else')).toBe(true);
	const address = new DataTransfer();
	address.setData('text/plain', 'https://example.com/page');
	send('paste', address);
	expect(editor.getShapes().some((each) => each.kind === 'link')).toBe(true);
});

test('a pasted or dropped picture file becomes an image, with its file in the document', async () => {
	const { editor, surface, root } = await board();
	const assets = () =>
		editor.store.all().filter((record): record is AssetRecord => record.type === 'asset');

	const pasted = new DataTransfer();
	pasted.items.add(await pictureFile());
	surface().dispatchEvent(
		new ClipboardEvent('paste', { clipboardData: pasted, bubbles: true, cancelable: true })
	);
	await expect.poll(() => editor.getShapes().map((shape) => shape.kind)).toEqual(['image']);
	const [image] = editor.getShapes();
	// At its own size, and the file kept as data in the document.
	expect([image.props.w, image.props.h]).toEqual([40, 30]);
	expect(assets()).toHaveLength(1);
	expect(assets()[0].mime).toBe('image/png');
	expect(assets()[0].name).toBe('square.png');
	await expect
		.poll(() => root().querySelector('.kd-shape img')?.getAttribute('src') ?? '')
		.toMatch(/^data:image\/png/);

	const dropped = new DataTransfer();
	dropped.items.add(await pictureFile('second.png'));
	const box = surface().getBoundingClientRect();
	surface().dispatchEvent(
		new DragEvent('drop', {
			dataTransfer: dropped,
			clientX: box.x + 400,
			clientY: box.y + 300,
			bubbles: true,
			cancelable: true
		})
	);
	await expect.poll(() => editor.getShapes().length).toBe(2);
	const second = editor.getShapes().find((shape) => shape.id !== image.id)!;
	// Where it was dropped: its middle is under the pointer.
	expect([second.x + 20, second.y + 15]).toEqual([400, 300]);
	expect(assets()).toHaveLength(2);
});

test('saving to a file hands the browser the whole document under the given name', async () => {
	const { editor } = await board();
	editor.createShape({ kind: 'note', x: 10, y: 20, props: { text: 'Kept' } });
	// The browser's own download: caught where the link is pressed.
	const press = HTMLAnchorElement.prototype.click;
	let saved: { name: string; href: string } | undefined;
	HTMLAnchorElement.prototype.click = function () {
		saved = { name: this.download, href: this.href };
	};
	try {
		saveFile(editor, 'My board');
	} finally {
		HTMLAnchorElement.prototype.click = press;
	}
	expect(saved!.name).toBe('My board.draw.json');
	const file = (await (await fetch(saved!.href)).json()) as DocumentFile;
	expect(
		file.records.some((record) => record.type === 'shape' && record.props.text === 'Kept')
	).toBe(true);

	// What was saved opens as the same board.
	const other = new Editor({ plugins: defaultPlugins });
	other.loadDocument(file.records);
	expect(other.getShapes().map((shape) => shape.props.text)).toEqual(['Kept']);
});

test('IndexedDB keeps a document record by record', async () => {
	const key = fresh('storage');
	const storage = indexedDbStorage(key);
	expect(await storage.load()).toBeUndefined();

	const editor = new Editor({ plugins: defaultPlugins });
	const one = editor.createShape({ kind: 'note', x: 0, y: 0, props: { text: 'One' } });
	const two = editor.createShape({ kind: 'note', x: 300, y: 0, props: { text: 'Two' } });
	await storage.save({ version: 1, put: editor.store.all(), remove: [] });
	await storage.save({ version: 1, put: [], remove: [two.id] });

	// Another connection reads what the first one wrote.
	const again = await indexedDbStorage(key).load();
	expect(again!.version).toBe(1);
	const ids = again!.records.map((record) => record.id);
	expect(ids).toContain(one.id);
	expect(ids).not.toContain(two.id);
	indexedDB.deleteDatabase(`svelte-draw:${key}`);
});

test('the line between tabs carries a message to the others, not back to its sender', async () => {
	const key = fresh('channel');
	const here = broadcastChannel(key);
	const there = broadcastChannel(key);
	const elsewhere = broadcastChannel(fresh('channel'));
	const heard: Record<string, ChannelMessage[]> = { here: [], there: [], elsewhere: [] };
	const stops = [
		here.listen((message) => heard.here.push(message)),
		there.listen((message) => heard.there.push(message)),
		elsewhere.listen((message) => heard.elsewhere.push(message))
	];
	here.post({ type: 'leave', id: 'someone' });
	await expect.poll(() => heard.there).toEqual([{ type: 'leave', id: 'someone' }]);
	expect(heard.here).toEqual([]);
	expect(heard.elsewhere).toEqual([]);
	for (const stop of stops) stop();
	for (const channel of [here, there, elsewhere]) channel.close?.();
});

test('a board kept in the browser comes back, and two of them stay in step', async () => {
	const key = fresh('board');
	const open = async () => {
		const editor = new Editor({ plugins: defaultPlugins });
		const stop = await persist(editor, {
			storage: indexedDbStorage(key),
			channel: broadcastChannel(key),
			seed: (editor) => editor.createShape({ kind: 'note', x: 0, y: 0, props: { text: 'First' } }),
			saveDelay: 0
		});
		return { editor, stop };
	};
	const texts = (editor: Editor) =>
		editor
			.getShapes()
			.map((shape) => shape.props.text)
			.sort();

	const first = await open();
	expect(texts(first.editor)).toEqual(['First']);
	// A second tab: it loads what the first one keeps, and is not seeded again.
	const second = await open();
	await expect.poll(() => texts(second.editor)).toEqual(['First']);

	first.editor.createShape({ kind: 'note', x: 300, y: 0, props: { text: 'Second' } });
	await expect.poll(() => texts(second.editor)).toEqual(['First', 'Second']);
	second.editor.deleteShapes(
		second.editor
			.getShapes()
			.filter((s) => s.props.text === 'First')
			.map((s) => s.id)
	);
	await expect.poll(() => texts(first.editor)).toEqual(['Second']);

	// Closed and opened again: what was there last is there.
	first.stop();
	second.stop();
	await wait(100);
	const later = await open();
	expect(texts(later.editor)).toEqual(['Second']);
	later.stop();
	indexedDB.deleteDatabase(`svelte-draw:${key}`);
});
