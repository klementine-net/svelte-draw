import type { Editor } from '@simon-lund/svelte-draw';

/** Takes back the last step, as Ctrl Z would. */
export default function run(editor: Editor) {
	editor.undo();
}
