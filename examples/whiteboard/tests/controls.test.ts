/*
 * The example's controls in a real browser (`pnpm test:browser`), around the library's canvas.
 */

import { expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { Editor } from '@simon-lund/svelte-draw';
import { defaultPlugins } from '@simon-lund/svelte-draw/svelte';
import Board from './board.svelte';

const board = async () => {
	const editor = new Editor({ plugins: defaultPlugins });
	const screen = await render(Board, { editor });
	return { editor, screen };
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

test('a right click on a shape opens the menu for it', async () => {
	const { editor, screen } = await board();
	const note = editor.createShape({ kind: 'note', x: 100, y: 100, props: { text: 'Hi' } });
	const paper = () => screen.container.querySelector<HTMLElement>('.note');
	await expect.poll(paper).toBeTruthy();

	const box = paper()!.getBoundingClientRect();
	paper()!.dispatchEvent(
		new MouseEvent('contextmenu', {
			clientX: box.x + box.width / 2,
			clientY: box.y + box.height / 2,
			bubbles: true,
			cancelable: true
		})
	);
	await expect.poll(() => editor.selection.get()).toEqual([note.id]);
	await expect.element(screen.getByRole('menu')).toBeVisible();
});
