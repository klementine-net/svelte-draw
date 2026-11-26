import type { Editor } from '@simon-lund/svelte-draw';

/** Two shapes and an arrow between them, as one undo step. */
export default function run(editor: Editor) {
	// Everything after a mark undoes together.
	editor.history.mark();
	const idea = editor.createShape({
		kind: 'geo',
		x: 0,
		y: 0,
		props: { w: 180, h: 100, text: 'Idea' }
	});
	const plan = editor.createShape({
		kind: 'geo',
		x: 320,
		y: -20,
		props: { geo: 'ellipse', w: 140, h: 140, text: 'Plan' },
		style: { color: 'blue', fill: 'tint' }
	});
	// An arrow attached at both ends: it follows when either shape moves.
	editor.createShape({
		kind: 'line',
		x: 0,
		y: 0,
		props: { arrow: true, start: idea.id, end: plan.id }
	});
	editor.zoomToFit();
}
