/* The board on the plugins page: three ideas to vote on, and the dot plugin beside the built-ins. */

import { Editor } from '@klementine/svelte-draw';
import { handPlugin, notePlugin, selectPlugin } from '@klementine/svelte-draw/svelte';
import { dotPlugin } from './plugin.ts';

export const plugins = [selectPlugin, handPlugin, notePlugin, dotPlugin];

export function dotBoard(): Editor {
	const editor = new Editor({ plugins });
	const ideas = [
		['Dark mode first', 'yellow'],
		['A shortcut list', 'blue'],
		['Export to PDF', 'green']
	] as const;
	ideas.forEach(([text, color], i) =>
		editor.createShape({
			kind: 'note',
			x: i * 220,
			y: 0,
			props: { w: 180, h: 180, text },
			style: { color }
		})
	);
	for (const [x, y, color] of [
		[40, 140, 'red'],
		[78, 146, 'violet'],
		[480, 138, 'red']
	] as const)
		editor.createShape({ kind: 'dot', x, y, style: { color } });
	editor.history.clear();
	return editor;
}
