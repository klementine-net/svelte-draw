/*
 * What the controls share: the scheme, and handing the keys back to the canvas.
 *
 * Light or dark, for the controls. Menus and hints are drawn outside the board, on the page, so
 * they cannot take it from the canvas around them: `Whiteboard` says it once here, and each
 * control puts it on its element. Without a whiteboard around them they follow the system.
 */

import { getContext, hasContext, setContext } from 'svelte';

export type Scheme = 'light' | 'dark' | 'auto';

const KEY = Symbol('whiteboard scheme');

/** Says which scheme the controls below use. A function, so a change reaches them. */
export function setScheme(scheme: () => Scheme) {
	setContext(KEY, scheme);
}

/** The scheme for a control: what a `Whiteboard` above said, or the system's. */
export function useScheme(): () => Scheme {
	return hasContext(KEY) ? getContext<() => Scheme>(KEY) : () => 'auto';
}

/**
 * Gives the keys back to the canvas a control belongs to: for a menu that has closed. A menu
 * is drawn outside the board, so without this the focus would be left on the page, and the
 * canvas's keys (V, D, Delete, undo) would do nothing until the next click.
 *
 * @example
 * <DropdownMenu.Content onCloseAutoFocus={(event) => toCanvas(event, bar)}>
 */
export function toCanvas(event: Event, control: Element | null) {
	const surface = control?.closest('.kd-root')?.querySelector<HTMLElement>('.kd-surface');
	if (!surface) return;
	event.preventDefault();
	surface.focus({ preventScroll: true });
}

/**
 * Opens the right-click menu where a finger rests on the canvas: half a second, within 8px.
 * A touch screen has no right click, and not every browser turns a long press into one
 * (Safari on a phone does not). The canvas then does what it does on a right click: it selects
 * what is under the finger, and the menu opens there.
 *
 * @example
 * <ContextMenu.Trigger>
 *   {#snippet child({ props })}{@render canvas({ ...props, [createAttachmentKey()]: holdForMenu })}{/snippet}
 * </ContextMenu.Trigger>
 */
export function holdForMenu(surface: HTMLElement) {
	let timer: ReturnType<typeof setTimeout> | undefined;
	let at: { x: number; y: number } | null = null;
	const forget = () => {
		clearTimeout(timer);
		at = null;
	};
	const down = (event: PointerEvent) => {
		forget();
		if (event.pointerType !== 'touch' || !event.isPrimary) return;
		const point = (at = { x: event.clientX, y: event.clientY });
		timer = setTimeout(() => {
			at = null;
			surface.dispatchEvent(
				new MouseEvent('contextmenu', {
					clientX: point.x,
					clientY: point.y,
					bubbles: true,
					cancelable: true
				})
			);
		}, 500);
	};
	// A finger that moves is drawing, dragging or scrolling; a second one is a pinch.
	const move = (event: PointerEvent) => {
		if (at && Math.hypot(event.clientX - at.x, event.clientY - at.y) > 8) forget();
	};
	// The browser's own long press came first (Android): one menu is enough.
	const native = (event: MouseEvent) => {
		if (event.isTrusted) forget();
	};
	surface.addEventListener('pointerdown', down);
	surface.addEventListener('pointermove', move);
	surface.addEventListener('pointerup', forget);
	surface.addEventListener('pointercancel', forget);
	surface.addEventListener('contextmenu', native);
	return () => {
		forget();
		surface.removeEventListener('pointerdown', down);
		surface.removeEventListener('pointermove', move);
		surface.removeEventListener('pointerup', forget);
		surface.removeEventListener('pointercancel', forget);
		surface.removeEventListener('contextmenu', native);
	};
}
