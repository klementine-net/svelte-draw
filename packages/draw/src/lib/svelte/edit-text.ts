/*
 * The text field of a shape that is being edited. A view attaches it to the element that shows
 * the shape's text while `editor.editing` is the shape:
 *
 *   {#if editor.editing.get() === shape.id}
 *     <span {@attach editText({ editor, text: () => shape.props.text, onchange })}></span>
 *   {:else}
 *     <span>{shape.props.text}</span>
 *   {/if}
 *
 * The element is filled once, when the edit starts: while someone types, the text in it is
 * theirs, and writing the store's copy back into it would move the caret. So `text` is read
 * once, untracked, and the store's changes never run the attachment again.
 */

import { untrack } from 'svelte';
import type { Attachment } from 'svelte/attachments';
import type { Editor } from '../core.ts';

export interface EditTextOptions {
	editor: Editor;
	/** The text as the edit starts. Read once. */
	text: () => string;
	/** Called with the whole text on every change. Write it to the shape. */
	onchange: (text: string) => void;
}

/** Makes the element the text field of the shape being edited. */
export function editText({ editor, text, onchange }: EditTextOptions): Attachment<HTMLElement> {
	return (node) => {
		node.contentEditable = 'plaintext-only';
		node.classList.add('kd-editing');
		node.textContent = untrack(text);
		node.focus({ preventScroll: true });

		// Everything is selected, so typing replaces a note's old words and one arrow key keeps them.
		const selection = getSelection();
		const range = document.createRange();
		range.selectNodeContents(node);
		selection?.removeAllRanges();
		selection?.addRange(range);

		// The browser keeps a line break at the end so the last empty line shows; it is not text.
		const oninput = () => onchange(node.innerText.replace(/\n$/, ''));
		// Focus that goes elsewhere (the toolbar, another window) ends the edit.
		const onblur = () => editor.stopEditing();
		node.addEventListener('input', oninput);
		node.addEventListener('blur', onblur);

		return () => {
			node.removeEventListener('input', oninput);
			node.removeEventListener('blur', onblur);
		};
	};
}
