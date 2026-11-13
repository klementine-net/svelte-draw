/*
 * From the browser's events to the editor's: which keys are held, where the pointer is, and
 * whether an event is the canvas's at all or belongs to a text field inside it.
 */

import type { DrawEvent, Editor, PointerInfo, Vec } from '../../index.ts';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/** The modifier keys of an event. `meta` is Command on a Mac, Ctrl elsewhere. */
export const modifiers = (event: MouseEvent | KeyboardEvent) => ({
	shift: event.shiftKey,
	alt: event.altKey,
	meta: isMac ? event.metaKey : event.ctrlKey
});

/** Whether the event is inside a shape's text field: then it is the field's, not the canvas's. */
export const inTextField = (event: Event) => (event.target as HTMLElement).isContentEditable;

/** Whether the event is in anything that is typed into: a shape's text field, a form field. */
export const inField = (event: Event) => {
	const target = event.target as HTMLElement;
	return target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
};

/** A pointer event at `point` (pixels from the canvas's top left), as the editor takes it. */
export function pointerInfo(
	event: PointerEvent,
	name: PointerInfo['name'],
	point: Vec
): PointerInfo {
	const isPen = event.pointerType === 'pen';
	return {
		type: 'pointer',
		name,
		point,
		button: event.button,
		pressure: isPen && event.pressure > 0 ? event.pressure : 0.5,
		isPen,
		...modifiers(event)
	};
}

export function doubleClickInfo(event: MouseEvent, point: Vec): PointerInfo {
	return {
		type: 'double_click',
		name: 'down',
		point,
		button: 0,
		pressure: 0.5,
		isPen: false,
		...modifiers(event)
	};
}

export function wheelInfo(event: WheelEvent, point: Vec): DrawEvent {
	const unit = event.deltaMode === 1 ? 16 : 1;
	return {
		type: 'wheel',
		point,
		delta: { x: event.deltaX * unit, y: event.deltaY * unit },
		shift: event.shiftKey,
		alt: event.altKey,
		// A pinch on a trackpad arrives as a wheel with Ctrl held.
		meta: event.ctrlKey || event.metaKey
	};
}

/**
 * A key event as the editor takes it, or null when the key is not the canvas's. Keys reach
 * the canvas from anywhere inside it (a tool's key still works after a click on the toolbar),
 * except where the focused control needs them itself: typing in a field, or moving and
 * pressing within a bar. Keys the canvas uses are kept from scrolling the page.
 */
export function keyInfo(
	event: KeyboardEvent,
	name: 'down' | 'up',
	surface: Element | null
): DrawEvent | null {
	const target = event.target as HTMLElement;
	if (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return null;
	// A shape's text field keeps its keys too; only Escape (not one that ends an IME
	// composition) goes on to the editor, which ends the edit.
	if (target.isContentEditable && (event.key !== 'Escape' || event.isComposing)) return null;
	if (target !== surface && /^(Arrow|Home|End|Enter| |Tab)/.test(event.key)) return null;
	const info: DrawEvent = {
		type: 'key',
		name,
		key: event.key,
		repeat: event.repeat,
		...modifiers(event)
	};
	// Keep the keys the canvas uses from scrolling the page or reaching the browser.
	if (
		name === 'down' &&
		(info.meta ? 'zyadg'.includes(event.key.toLowerCase()) : event.key.startsWith('Arrow'))
	)
		event.preventDefault();
	return info;
}

/**
 * A right-click at `page` picks what is under it first (also a locked shape, so it can be
 * unlocked); on the empty canvas outside the selection it lets go of the selection.
 */
export function selectForMenu(editor: Editor, page: Vec) {
	const leaf = editor.getShapeAtPoint(page, { locked: true });
	const hit = leaf && editor.getSelectable(leaf);
	const bounds = editor.getSelectionBounds();
	const inSelection =
		bounds &&
		page.x >= bounds.x &&
		page.x <= bounds.x + bounds.w &&
		page.y >= bounds.y &&
		page.y <= bounds.y + bounds.h;
	if (hit && !editor.selection.peek().includes(hit.id)) editor.select([hit.id]);
	else if (!hit && !inSelection) editor.select([]);
}
