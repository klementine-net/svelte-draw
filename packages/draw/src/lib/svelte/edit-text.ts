/*
 * The text field of a shape that is being edited. A view puts it on the element that shows
 * the shape's text while `editor.editing` is the shape:
 *
 *   {#if editor.editing.get() === shape.id}
 *     <span use:editText={{ editor, text: shape.props.text, onchange }}></span>
 *   {:else}
 *     <span>{shape.props.text}</span>
 *   {/if}
 *
 * The element is filled once, when the edit starts: while someone types, the text in it is
 * theirs, and writing the store's copy back into it would move the caret.
 */

import type { Editor } from '../index.ts';

export interface EditTextOptions {
	editor: Editor;
	/** The text as the edit starts. */
	text: string;
	/** Called with the whole text on every change. Write it to the shape. */
	onchange: (text: string) => void;
}

export function editText(node: HTMLElement, { editor, text, onchange }: EditTextOptions) {
	node.contentEditable = 'plaintext-only';
	node.classList.add('kd-editing');
	node.textContent = text;
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

	return {
		destroy() {
			node.removeEventListener('input', oninput);
			node.removeEventListener('blur', onblur);
		}
	};
}
