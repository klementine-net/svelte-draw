<script lang="ts">
	// The handwriting font for hand-drawn text (`--kd-font-hand`), and the controls' typeface.
	import '@fontsource/caveat/600.css';
	import '@fontsource/instrument-sans/400.css';
	import '@fontsource/instrument-sans/500.css';
	import '@fontsource/instrument-sans/600.css';
	import { defaultPlugins, Editor } from '@klementine/svelte-draw';
	import { Whiteboard } from './lib/ui';

	const editor = new Editor({ plugins: defaultPlugins });

	// A first picture for a board that was never saved, made the way a script would: through
	// the editor, not through the UI. `Whiteboard` calls it once; after that the board is whatever
	// was drawn on it, kept in this browser and shared with its other tabs.
	function seed(editor: Editor) {
		// On a narrow window the notes go below the shapes instead of beside them.
		const notes = innerWidth < 600 ? { x: -500, y: 620 } : { x: 0, y: 0 };
		const rectangle = editor.createShape({
			kind: 'geo',
			x: 120,
			y: 120,
			props: { w: 220, h: 140, text: 'An idea' }
		});
		const circle = editor.createShape({
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
			x: 660 + notes.x,
			y: 110 + notes.y,
			props: { text: 'Double click to write' },
			style: { color: 'ink' }
		});
		editor.createShape({
			kind: 'note',
			x: 790 + notes.x,
			y: 250 + notes.y,
			props: { text: 'Make it pop' },
			style: { color: 'violet' }
		});
		editor.createShape({
			kind: 'note',
			x: 640 + notes.x,
			y: 330 + notes.y,
			props: {
				text: 'Write a lot on a note and the writing gets smaller, so that all of it still fits on the paper'
			},
			style: { color: 'blue' }
		});
		editor.createShape({
			kind: 'note',
			x: 850 + notes.x,
			y: 470 + notes.y,
			props: { text: 'It’s pronounced “gif”' },
			style: { color: 'green' }
		});
		// An arrow attached at both ends: move either shape and it follows.
		editor.createShape({
			kind: 'line',
			x: 345,
			y: 190,
			props: { dx: 70, dy: 20, arrow: true, start: rectangle.id, end: circle.id }
		});
		editor.createShape({
			kind: 'line',
			x: 150,
			y: 480,
			props: { dx: 260, dy: 0 },
			style: { color: 'red', look: 'precise' }
		});
		editor.createShape({
			kind: 'geo',
			x: 470,
			y: 400,
			props: { geo: 'star', w: 130, h: 130 },
			style: { color: 'yellow', fill: 'tint' }
		});
		editor.createShape({
			kind: 'geo',
			x: 150,
			y: 560,
			rotation: -0.12,
			props: { geo: 'cloud', w: 220, h: 130, text: 'Turn me' },
			style: { color: 'violet', fill: 'tint', look: 'dashed' }
		});
		editor.createShape({
			kind: 'text',
			x: 120,
			y: 60,
			props: { text: 'svelte-draw', w: 230, h: 40 },
			style: { size: 'l' }
		});
		seeded = true;
	}

	// A first board that does not fit the window is shown whole: a phone would open on a corner
	// of it. It waits for the canvas to know its size, and an address that names a view wins.
	let seeded = $state(false);
	const linked = location.hash.includes('view=');
	let fitted = false;
	$effect(() => {
		const { w } = editor.viewport.get();
		if (!seeded || fitted || w === 0) return;
		fitted = true;
		if (linked) return;
		const view = editor.getViewportPageBounds();
		const cut = editor.getShapes().some((shape) => {
			const box = editor.getShapePageBounds(shape);
			return (
				box.x < view.x ||
				box.y < view.y ||
				box.x + box.w > view.x + view.w ||
				box.y + box.h > view.y + view.h
			);
		});
		if (cut) editor.zoomToFit();
	});

	// For poking at it from the console.
	(globalThis as { editor?: Editor }).editor = editor;
</script>

<div style="height: 100%">
	<Whiteboard {editor} persistenceKey="whiteboard" {seed} minimap deepLinks />
</div>
