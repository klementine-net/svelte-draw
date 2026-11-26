/*
 * The example's controls in a real browser (`pnpm test:browser`), around the library's canvas:
 * what each of them does, so they can be rebuilt or restyled without losing it.
 */

import { expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { Editor, type GeoShape } from '@klementine/svelte-draw';
import { defaultPlugins } from '@klementine/svelte-draw/svelte';
import Board from './board.svelte';

const board = async (scheme?: 'light' | 'dark') => {
	const editor = new Editor({ plugins: defaultPlugins });
	const screen = await render(Board, { editor, scheme });
	const surface = () => screen.container.querySelector<HTMLElement>('.kd-surface')!;
	/** A right click at a point of the canvas, as the browser sends it. */
	const rightClick = (x: number, y: number) => {
		const box = surface().getBoundingClientRect();
		surface().dispatchEvent(
			new MouseEvent('contextmenu', {
				clientX: box.x + x,
				clientY: box.y + y,
				bubbles: true,
				cancelable: true
			})
		);
	};
	return { editor, screen, surface, rightClick };
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

test("a tool is picked from the bar and from its group's menu", async () => {
	const { editor, screen } = await board();
	await screen.getByLabelText('Draw', { exact: true }).click();
	expect(editor.tool).toBe('draw');

	await screen.getByLabelText('More shapes', { exact: true }).click();
	await screen.getByRole('menuitemradio', { name: 'Star' }).click();
	expect(editor.tool).toBe('star');
	await expect.element(screen.getByLabelText('Star', { exact: true })).toBeVisible();
});

test('a right click on a shape opens the menu for it', async () => {
	const { editor, screen, rightClick } = await board();
	const note = editor.createShape({ kind: 'note', x: 100, y: 100, props: { text: 'Hi' } });
	await expect.poll(() => screen.container.querySelector('.note')).toBeTruthy();

	rightClick(190, 190);
	await expect.poll(() => editor.selection.get()).toEqual([note.id]);
	await expect.element(screen.getByRole('menu')).toBeVisible();
});

test('the canvas has its keys back after a menu closes', async () => {
	const { editor, screen, rightClick } = await board();

	await screen.getByLabelText('More shapes', { exact: true }).click();
	await expect.element(screen.getByRole('menu')).toBeVisible();
	await userEvent.keyboard('{Escape}');
	await expect.element(screen.getByRole('menu')).not.toBeInTheDocument();
	await userEvent.keyboard('d');
	expect(editor.tool).toBe('draw');

	await screen.getByRole('button', { name: 'Pages: Page 1' }).click();
	await expect.element(screen.getByRole('menu')).toBeVisible();
	await userEvent.keyboard('{Escape}');
	await expect.element(screen.getByRole('menu')).not.toBeInTheDocument();
	await userEvent.keyboard('n');
	expect(editor.tool).toBe('note');

	rightClick(400, 300);
	await expect.element(screen.getByRole('menu')).toBeVisible();
	await userEvent.keyboard('{Escape}');
	await expect.element(screen.getByRole('menu')).not.toBeInTheDocument();
	await userEvent.keyboard('v');
	expect(editor.tool).toBe('select');
});

test('a page is renamed with Enter, and Escape leaves its name', async () => {
	const { editor, screen } = await board();
	const rename = async (typed: string) => {
		await screen.getByRole('button', { name: /^Pages: / }).click();
		await screen.getByRole('menuitem', { name: 'Rename page' }).click();
		const field = screen.getByRole('textbox', { name: 'Rename page' });
		await expect.element(field).toHaveFocus();
		await userEvent.keyboard(typed);
	};

	await rename('Plan{Enter}');
	await expect.poll(() => editor.getPage()?.name).toBe('Plan');
	await expect.element(screen.getByRole('button', { name: 'Pages: Plan' })).toBeVisible();

	await rename('Other{Escape}');
	await expect.element(screen.getByRole('button', { name: 'Pages: Plan' })).toBeVisible();
	expect(editor.getPage()?.name).toBe('Plan');
	// The name being typed is not the canvas's keys: no tool was picked by its letters.
	expect(editor.tool).toBe('select');
});

test('a page is added from the menu and gone to', async () => {
	const { editor, screen } = await board();
	await screen.getByRole('button', { name: 'Pages: Page 1' }).click();
	await screen.getByRole('menuitem', { name: 'New page' }).click();
	await expect.poll(() => editor.getPages().length).toBe(2);

	await screen.getByRole('button', { name: /^Pages: / }).click();
	await screen.getByRole('menuitemradio', { name: 'Page 1' }).click();
	await expect.poll(() => editor.getPage()?.name).toBe('Page 1');
});

test('the style panel styles what is selected', async () => {
	const { editor, screen } = await board();
	const shape = editor.createShape({ kind: 'geo', x: 100, y: 100, props: { w: 120, h: 90 } });
	editor.select([shape.id]);

	await screen.getByRole('radio', { name: 'Red', exact: true }).click();
	await expect.poll(() => editor.getShape<GeoShape>(shape.id)?.style.color).toBe('red');
	await screen.getByRole('radio', { name: 'Full fill' }).click();
	await expect.poll(() => editor.getShape<GeoShape>(shape.id)?.style.fill).toBe('solid');
	// Picking the picked one again keeps it: a style always has a value.
	await screen.getByRole('radio', { name: 'Red', exact: true }).click();
	expect(editor.getShape<GeoShape>(shape.id)?.style.color).toBe('red');
});

test('undo and redo are off until there is something to take back', async () => {
	const { editor, screen } = await board();
	const undo = screen.getByRole('button', { name: 'Undo' });
	const redo = screen.getByRole('button', { name: 'Redo' });
	await expect.element(undo).toBeDisabled();
	await expect.element(redo).toBeDisabled();

	editor.history.mark();
	editor.createShape({ kind: 'geo', x: 100, y: 100, props: { w: 120, h: 90 } });
	await expect.element(undo).toBeEnabled();
	await undo.click();
	await expect.poll(() => editor.getShapes().length).toBe(0);
	await expect.element(redo).toBeEnabled();
	await redo.click();
	await expect.poll(() => editor.getShapes().length).toBe(1);
});

test('the zoom control zooms, and its number goes back to 100%', async () => {
	const { editor, screen } = await board();
	await screen.getByRole('button', { name: 'Zoom in' }).click();
	await expect.poll(() => editor.camera.get().z).toBeGreaterThan(1);
	await screen.getByRole('button', { name: /^Back to 100%/ }).click();
	await expect.poll(() => editor.camera.get().z).toBe(1);
});

test('the right-click menu opens a sub-menu and flips a switch', async () => {
	const { editor, screen, rightClick } = await board();
	const shape = editor.createShape({ kind: 'geo', x: 100, y: 100, props: { w: 160, h: 120 } });
	await expect.poll(() => screen.container.querySelector('.kd-shape')).toBeTruthy();

	rightClick(180, 104);
	await expect.poll(() => editor.selection.get()).toEqual([shape.id]);
	await screen.getByRole('menuitem', { name: 'Order' }).click();
	await expect.element(screen.getByRole('menuitem', { name: 'Send to back' })).toBeVisible();
	await userEvent.keyboard('{Escape}{Escape}');

	editor.select([]);
	expect(editor.grid.get().show).toBe(true);
	rightClick(500, 400);
	await screen.getByRole('menuitemcheckbox', { name: 'Show the grid' }).click();
	await expect.poll(() => editor.grid.get().show).toBe(false);
});

test("a tool's name and key show when it is pointed at", async () => {
	const { screen } = await board();
	await screen.getByLabelText('Draw', { exact: true }).hover();
	// The hint is drawn outside the board, on the page: its name and its key, nothing else.
	const hint = () =>
		[...document.body.querySelectorAll<HTMLElement>('*')].find(
			(element) =>
				!element.closest('.kd-root') && /^Draw\s*D$/.test((element.textContent ?? '').trim())
		);
	await expect.poll(hint, { timeout: 3000 }).toBeTruthy();
	expect(hint()!.getBoundingClientRect().width).toBeGreaterThan(0);
});

test('menus and hints are drawn outside the board and still follow its scheme', async () => {
	// The system is light here; the board is asked to be dark.
	const { screen, rightClick } = await board('dark');
	const ground = (selector: string) => {
		const element = document.querySelector<HTMLElement>(selector);
		return element ? getComputedStyle(element).backgroundColor : '';
	};
	expect(ground('.kd-root')).toBe('rgb(27, 25, 22)');
	expect(ground('[role=toolbar][aria-label=Tools]')).toBe('rgb(38, 36, 32)');

	await screen.getByLabelText('More shapes', { exact: true }).click();
	await expect.poll(() => ground('[role=menu]')).toBe('rgb(46, 43, 38)');
	expect(document.querySelector('[role=menu]')!.closest('.kd-root')).toBeNull();
	await userEvent.keyboard('{Escape}');

	rightClick(500, 300);
	await expect.poll(() => ground('[role=menu]')).toBe('rgb(46, 43, 38)');
	await userEvent.keyboard('{Escape}');

	await screen.getByLabelText('Draw', { exact: true }).hover();
	await expect.poll(() => ground('.wb-tip'), { timeout: 3000 }).toBe('rgb(46, 43, 38)');
});

test('a finger resting on the canvas opens the menu; a finger that moves does not', async () => {
	const { editor, screen, surface } = await board();
	const shape = editor.createShape({ kind: 'geo', x: 100, y: 100, props: { w: 160, h: 120 } });
	await expect.poll(() => screen.container.querySelector('.kd-shape')).toBeTruthy();
	const box = surface().getBoundingClientRect();
	// A finger, as the browser reports it. (Pointer 1 always exists, so the canvas can capture it.)
	const finger = (type: string, x: number, y: number) =>
		surface().dispatchEvent(
			new PointerEvent(type, {
				pointerType: 'touch',
				pointerId: 1,
				isPrimary: true,
				clientX: box.x + x,
				clientY: box.y + y,
				bubbles: true,
				cancelable: true
			})
		);
	const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

	// It rests on the shape's edge, drifting a little as a real finger does.
	finger('pointerdown', 180, 102);
	await wait(250);
	finger('pointermove', 182, 103);
	await wait(350);
	await expect.element(screen.getByRole('menu')).toBeVisible();
	expect(editor.selection.get()).toEqual([shape.id]);
	finger('pointerup', 182, 103);
	await expect.element(screen.getByRole('menuitem', { name: 'Duplicate' })).toBeVisible();
	await userEvent.keyboard('{Escape}');
	await expect.element(screen.getByRole('menu')).not.toBeInTheDocument();

	// It drags: that is a move, however long it takes.
	finger('pointerdown', 180, 102);
	await wait(100);
	finger('pointermove', 210, 130);
	await wait(600);
	finger('pointerup', 210, 130);
	expect(document.querySelector('[role=menu]')).toBeNull();
});
