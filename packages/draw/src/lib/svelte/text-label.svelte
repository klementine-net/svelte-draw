<script lang="ts">
	import type { Editor, ShapeRecord } from '../index.ts';
	import { editText } from './edit-text.ts';

	/**
	 * TextLabel: the words of a shape, and the field they become while the shape is typed into
	 * (`editor.editing`). The element around it sets the typeface, size and alignment.
	 *
	 * @example
	 * <div class="kd-label" data-font="hand"><TextLabel {editor} {shape} text={shape.props.text} {onchange} /></div>
	 */
	let {
		editor,
		shape,
		text,
		onchange
	}: { editor: Editor; shape: ShapeRecord; text: string; onchange: (text: string) => void } =
		$props();

	const editing = $derived(editor.editing.get() === shape.id);
</script>

{#if editing}
	<span class="kd-text" {@attach editText({ editor, text: () => text, onchange })}></span>
{:else}
	<span class="kd-text">{text}</span>
{/if}
