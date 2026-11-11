<script lang="ts">
	import { Editor } from '@klementine/draw';
	import { defaultPlugins, Draw } from '@klementine/draw/svelte';
	import { notePlugin } from './note/note.ts';

	// The built-in plugins plus one of the demo's own.
	const plugins = [...defaultPlugins, notePlugin];
	const editor = new Editor({ plugins });

	// A first picture, made the way a script would: through the editor, not through the UI.
	editor.createShape({ kind: 'geo', x: 120, y: 120, props: { w: 220, h: 140 } });
	editor.createShape({
		kind: 'geo',
		x: 420,
		y: 150,
		props: { geo: 'ellipse', w: 180, h: 180 },
		style: { color: 'blue', fill: 'tint' }
	});
	editor.createShape({
		kind: 'geo',
		x: 180,
		y: 330,
		props: { w: 200, h: 110 },
		style: { color: 'green', fill: 'solid', look: 'precise' }
	});
	editor.createShape({
		kind: 'note',
		x: 660,
		y: 110,
		props: { text: 'Double click to write' },
		style: { color: 'ink' }
	});
	editor.createShape({
		kind: 'note',
		x: 790,
		y: 250,
		props: { text: 'Make it pop' },
		style: { color: 'violet' }
	});
	editor.createShape({
		kind: 'note',
		x: 640,
		y: 330,
		props: {
			text: 'Write a lot on a note and the writing gets smaller, so that all of it still fits on the paper'
		},
		style: { color: 'blue' }
	});
	editor.createShape({
		kind: 'note',
		x: 850,
		y: 470,
		props: { text: 'It’s pronounced “gif”' },
		style: { color: 'green' }
	});
	editor.createShape({ kind: 'line', x: 345, y: 190, props: { dx: 70, dy: 20, arrow: true } });
	editor.createShape({
		kind: 'line',
		x: 150,
		y: 480,
		props: { dx: 260, dy: 0 },
		style: { color: 'red', look: 'precise' }
	});
	editor.history.clear();

	// For poking at it from the console.
	(globalThis as { editor?: Editor }).editor = editor;
</script>

<div class="h-full">
	<Draw {editor} {plugins} />
</div>
