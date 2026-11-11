<script lang="ts">
	import '@fontsource/caveat/600.css';
	import type { ShapeViewProps } from '@klementine/draw/svelte';
	import { noteTilt, type NoteShape } from './note.ts';

	/**
	 * NoteView: a sticky note. Flat bright paper with a slightly darker band on top where the glue is,
	 * handwriting, and a slight tilt of its own (from its id, so it never changes), the way a
	 * note lands when it is stuck on by hand. It is paper, so it keeps its colour and dark
	 * writing in both themes. A view may be plain HTML; it need not be SVG.
	 */
	let { shape }: ShapeViewProps<NoteShape> = $props();

	// Only the picture (and its outline) tilts; the shape's bounds stay upright.
	const tilt = $derived(noteTilt(shape.id));

	// The writing fits the paper: as large as it can be (up to 34px) with every word still on
	// the note, so a long text gets smaller instead of being cut off.
	const MAX_SIZE = 34;
	const MIN_SIZE = 9;
	let paragraph: HTMLParagraphElement;
	let size = $state(MAX_SIZE);

	$effect(() => {
		// Re-fit when the words or the paper change.
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
		size = fits(MAX_SIZE) ? MAX_SIZE : low;
		paragraph.style.fontSize = `${size}px`;
	});
</script>

<div
	class="note"
	data-color={shape.style.color}
	style:width="{shape.props.w}px"
	style:height="{shape.props.h}px"
	style:rotate="{tilt}deg"
>
	<p bind:this={paragraph}>{shape.props.text}</p>
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
		overflow-wrap: anywhere;
		font:
			600 34px/1.05 'Caveat',
			'Bradley Hand',
			cursive;
	}
</style>
