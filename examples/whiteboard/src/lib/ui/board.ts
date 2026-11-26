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
