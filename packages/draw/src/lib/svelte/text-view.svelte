<script lang="ts">
	import type { Attachment } from 'svelte/attachments';
	import { FONT_SIZE, type TextShape } from '../core.ts';
	import type { ShapeViewProps } from './plugin.ts';
	import TextLabel from './text-label.svelte';

	/**
	 * TextView: words on the canvas. The core cannot measure text, so the view tells the editor
	 * how large the words are on this screen (`editor.setMeasured`). That size is not part of
	 * the document: nothing is written for it.
	 */
	let { shape, editor }: ShapeViewProps<TextShape> = $props();

	const measure = (element: HTMLElement, id: string) =>
		editor.setMeasured(id, {
			w: Math.ceil(element.offsetWidth),
			h: Math.ceil(element.offsetHeight)
		});

	// At once when the words, the type or the wrap width change…
	const measureNow: Attachment<HTMLElement> = (element) => {
		void [shape.props.text, shape.props.w, shape.props.auto, shape.style.size, shape.style.font];
		measure(element, shape.id);
	};
	// …and whenever the browser lays the words out anew (a font that arrives late). The size
	// is the screen's, not the document's: it goes when the view goes.
	const measureOnLayout: Attachment<HTMLElement> = (element) => {
		const id = shape.id;
		const observer = new ResizeObserver(() => measure(element, id));
		observer.observe(element);
		return () => {
			observer.disconnect();
			editor.setMeasured(id, undefined);
		};
	};
</script>

<div
	{@attach measureNow}
	{@attach measureOnLayout}
	class="kd-label kd-text-shape"
	data-font={shape.style.font ?? 'hand'}
	data-align={shape.style.align ?? 'middle'}
	style:width={shape.props.auto ? 'max-content' : `${shape.props.w}px`}
	style:--kd-font-size="{FONT_SIZE[shape.style.size]}px"
>
	<TextLabel
		{editor}
		{shape}
		text={shape.props.text}
		onchange={(text) => editor.updateShape(shape.id, { props: { text } })}
	/>
</div>
