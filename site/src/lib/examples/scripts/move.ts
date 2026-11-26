import type { Editor } from '@simon-lund/svelte-draw';

/** Moves the first box down a little; the arrow attached to it follows. */
export default function run(editor: Editor) {
	const box = editor.getShapes().find((shape) => shape.kind === 'geo');
	if (!box) return 'Add the shapes first.';
	editor.history.mark();
	editor.updateShape(box.id, { y: box.y + 60 });
}
