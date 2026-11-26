import type { Editor } from '@simon-lund/svelte-draw';

/** Picks everything and lines it up along the middle. */
export default function run(editor: Editor) {
	editor.selectAll();
	editor.alignSelection('middle');
}
