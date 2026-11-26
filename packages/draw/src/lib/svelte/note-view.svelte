<script lang="ts">
	import type { Attachment } from 'svelte/attachments';
	import { noteTilt, type NoteShape } from '../core.ts';
	import { editText } from './edit-text.ts';
	import type { ShapeViewProps } from './plugin.ts';

	/**
	 * NoteView: a sticky note. Flat bright paper with a slightly darker band on top where the glue is,
	 * handwriting, and a slight tilt of its own (from its id, so it never changes), the way a
	 * note lands when it is stuck on by hand. It is paper, so it keeps its colour and dark
	 * writing in both themes. A view may be plain HTML; it need not be SVG.
	 */
	let { shape, editor }: ShapeViewProps<NoteShape> = $props();

	// A double click (or Enter) on the note makes its writing a text field.
	const editing = $derived(editor.editing.get() === shape.id);
	const write = (text: string) => editor.updateShape(shape.id, { props: { ...shape.props, text } });

	// Only the picture (and its outline) tilts; the shape's bounds stay upright.
	const tilt = $derived(noteTilt(shape.id));

	// The writing fits the paper: as large as it can be (up to 34px) with every word still on
	// the note, so a long text gets smaller instead of being cut off. Fitted again when the
	// words or the paper change.
	const MAX_SIZE = 34;
	const MIN_SIZE = 9;
	const fit: Attachment<HTMLElement> = (paragraph) => {
		void [shape.props.text, shape.props.w, shape.props.h];
		const fits = (px: number) => {
			paragraph.style.fontSize = `${px}px`;
			return (
				paragraph.scrollHeight <= paragraph.clientHeight &&
				paragraph.scrollWidth <= paragraph.clientWidth
			);
		};
		let low = MIN_SIZE;
		let high = MAX_SIZE;
		while (high - low > 0.5) {
			const middle = (low + high) / 2;
			if (fits(middle)) low = middle;
			else high = middle;
		}
		paragraph.style.fontSize = `${fits(MAX_SIZE) ? MAX_SIZE : low}px`;
	};
</script>

<div
	class="note"
	data-color={shape.style.color}
	style:width="{shape.props.w}px"
	style:height="{shape.props.h}px"
	style:rotate="{tilt}deg"
>
	<p {@attach fit}>
		{#if editing}
			<span {@attach editText({ editor, text: () => shape.props.text, onchange: write })}></span>
		{:else}
			<span>{shape.props.text}</span>
		{/if}
	</p>
</div>

<style>
	.note {
		box-sizing: border-box;
		display: grid;
		grid-template-rows: 20% 1fr;
		/* Paper has its own colours, the same in light and dark; the band is a shade darker. */
		--paper: #fdf3a0;
		background: linear-gradient(
			to bottom,
			color-mix(in oklab, var(--paper) 96.5%, black) 20%,
			var(--paper) 20%
		);
		color: #23221d;
		/* The light comes from the top right: the note casts down and to the left. */
		box-shadow:
			0 1px 1px rgb(0 0 0 / 0.12),
			-14px 12px 18px -10px rgb(0 0 0 / 0.28);
	}
	.note[data-color='yellow'] {
		--paper: #fbd768;
	}
	.note[data-color='red'] {
		--paper: #ffb3a9;
	}
	.note[data-color='green'] {
		--paper: #88e0a5;
	}
	.note[data-color='blue'] {
		--paper: #82c7ff;
	}
	.note[data-color='violet'] {
		--paper: #fdbdf4;
	}
	.note[data-color='grey'] {
		--paper: #e6e6e6;
	}
	p {
		grid-row: 2;
		margin: 0;
		padding: 0 14px 14px;
		min-height: 0;
		/* Centred while it fits; `safe` keeps an overflow at the bottom, where it can be measured. */
		display: flex;
		align-items: safe center;
		justify-content: center;
		overflow: hidden;
		text-align: center;
		text-wrap: balance;
		font: 600 34px/1.05 var(--kd-font-hand);
	}
	span {
		/* A block of its own inside the centring box, so line breaks and the caret behave. */
		min-width: 1ch;
		max-width: 100%;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
</style>
