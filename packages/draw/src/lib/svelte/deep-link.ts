/*
 * A link to a place on the canvas: the page and the view are kept in the address (after the
 * #), so a copied address opens where it was copied.
 */

import type { Editor } from '../core.ts';

/**
 * Goes to the place the address names, then keeps the address up to date as the view moves.
 * Returns the function that stops it.
 */
export function deepLink(editor: Editor): () => void {
	const read = () => {
		const params = new URLSearchParams(location.hash.slice(1));
		const page = params.get('page');
		const view = params.get('view')?.split(',').map(Number);
		if (page) editor.setPage(page);
		if (view?.length === 3 && view.every(Number.isFinite) && view[2] > 0)
			editor.camera.set({ x: view[0], y: view[1], z: view[2] });
	};
	let waiting: ReturnType<typeof setTimeout> | undefined;
	const write = () => {
		clearTimeout(waiting);
		waiting = setTimeout(() => {
			const { x, y, z } = editor.camera.peek();
			const params = new URLSearchParams({
				page: editor.pageId.peek(),
				view: [Math.round(x), Math.round(y), Math.round(z * 100) / 100].join(',')
			});
			history.replaceState(history.state, '', `#${params}`);
		}, 300);
	};
	read();
	const stops = [editor.camera.listen(write), editor.pageId.listen(write)];
	addEventListener('hashchange', read);
	return () => {
		for (const stop of stops) stop();
		clearTimeout(waiting);
		removeEventListener('hashchange', read);
	};
}
