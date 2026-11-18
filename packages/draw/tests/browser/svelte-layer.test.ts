/*
 * The Svelte layer in a real browser (`pnpm test:browser`): what the views and the canvas do
 * with the DOM (fitting, measuring, focus, the wheel, text fields). The engine's own tests run
 * under Node (`pnpm test`).
 */

import { expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { Editor, type NoteShape, type TextShape } from '../../src/lib/index.ts';
import { defaultPlugins } from '../../src/lib/svelte/index.ts';
import Board from './board.svelte';

const board = async (size?: { width: number; height: number }) => {
	const editor = new Editor({ plugins: defaultPlugins });
	const screen = await render(Board, { editor, ...size });
	const surface = () => screen.container.querySelector<HTMLElement>('.kd-surface')!;
	return { editor, screen, surface };
};

test('a group in the toolbar shows the tool picked from it last, also after another tool', async () => {
	const { editor, screen } = await board();
	await expect.element(screen.getByLabelText('Rectangle', { exact: true })).toBeVisible();

	editor.setTool('ellipse');
	await expect.element(screen.getByLabelText('Ellipse', { exact: true })).toBeVisible();
	await expect.element(screen.getByLabelText('Rectangle', { exact: true })).not.toBeInTheDocument();

	editor.setTool('select');
	await expect.element(screen.getByLabelText('Ellipse', { exact: true })).toBeVisible();
	await expect.element(screen.getByLabelText('Rectangle', { exact: true })).not.toBeInTheDocument();
});

test('the canvas knows its size at once and follows it', async () => {
	const { editor, screen } = await board({ width: 800, height: 600 });
	expect(editor.viewport.get()).toEqual({ w: 800, h: 600 });

	await screen.rerender({ width: 640, height: 480 });
	await expect.poll(() => editor.viewport.get()).toEqual({ w: 640, h: 480 });
});

test('the wheel moves the view and never scrolls the page', async () => {
	const { editor, surface } = await board();
	const before = editor.camera.get();
	const wheel = new WheelEvent('wheel', {
		deltaY: 120,
		clientX: 200,
		clientY: 200,
		bubbles: true,
		cancelable: true
	});
	surface().dispatchEvent(wheel);
	expect(wheel.defaultPrevented).toBe(true);
	expect(editor.camera.get()).not.toEqual(before);
});

test('typing into a note writes every key, replaces the old words, and keeps the caret', async () => {
	const { editor, screen, surface } = await board();
	const note = editor.createShape({ kind: 'note', x: 100, y: 100, props: { text: 'old words' } });

	editor.startEditing(note.id);
	const field = () => screen.container.querySelector<HTMLElement>('[contenteditable]');
	await expect.poll(() => document.activeElement === field()).toBe(true);
	expect(field()!.textContent).toBe('old words');

	await userEvent.keyboard('abc');
	await expect.poll(() => editor.getShape<NoteShape>(note.id)?.props.text).toBe('abc');
	expect(field()!.textContent).toBe('abc');

	// Focus that leaves the field ends the edit, and the canvas gets its keys back.
	field()!.blur();
	await expect.poll(() => editor.editing.get()).toBe(null);
	editor.startEditing(note.id);
	await expect.poll(() => document.activeElement === field()).toBe(true);
	editor.stopEditing();
	await expect.poll(() => document.activeElement).toBe(surface());
	expect(editor.getShape<NoteShape>(note.id)?.props.text).toBe('abc');
});

test('typing into a text shape writes every key and keeps the caret', async () => {
	const { editor, screen } = await board();
	const text = editor.createShape({ kind: 'text', x: 100, y: 100, props: { text: 'old' } });

	editor.startEditing(text.id);
	const field = () => screen.container.querySelector<HTMLElement>('[contenteditable]');
	await expect.poll(() => document.activeElement === field()).toBe(true);

	await userEvent.keyboard('abc');
	await expect.poll(() => editor.getShape<TextShape>(text.id)?.props.text).toBe('abc');
	expect(field()!.textContent).toBe('abc');
});

test('a note writes as large as fits the paper, and smaller for many words', async () => {
	const { editor, screen } = await board();
	const note = editor.createShape({ kind: 'note', x: 100, y: 100, props: { text: 'Hi' } });
	const size = () => {
		const paragraph = screen.container.querySelector<HTMLElement>('.note p');
		return paragraph ? parseFloat(paragraph.style.fontSize) : NaN;
	};
	await expect.poll(size).toBe(34);

	editor.updateShape(note.id, { props: { text: 'many words '.repeat(30) } });
	await expect.poll(size).toBeLessThan(20);

	editor.updateShape(note.id, { props: { w: 600, h: 600 } });
	await expect.poll(size).toBeGreaterThan(20);

	editor.updateShape(note.id, { props: { text: 'Hi' } });
	await expect.poll(size).toBe(34);
});

test('a text shape tells the editor its size, and forgets it when it goes', async () => {
	const { editor, screen } = await board();
	const text = editor.createShape({ kind: 'text', x: 100, y: 100, props: { text: 'Hello' } });
	const element = () => screen.container.querySelector<HTMLElement>('.kd-text-shape')!;
	const shown = () => ({
		w: Math.ceil(element().offsetWidth),
		h: Math.ceil(element().offsetHeight)
	});

	await expect.poll(element).toBeTruthy();
	await expect.poll(() => editor.getMeasured(text.id)).toEqual(shown());
	const short = editor.getMeasured(text.id)!.w;

	editor.updateShape(text.id, { props: { text: 'Hello, a good deal longer now' } });
	await expect.poll(() => editor.getMeasured(text.id)!.w).toBeGreaterThan(short);
	expect(editor.getMeasured(text.id)).toEqual(shown());

	editor.deleteShapes([text.id]);
	await expect.poll(() => editor.getMeasured(text.id)).toBeUndefined();
});
