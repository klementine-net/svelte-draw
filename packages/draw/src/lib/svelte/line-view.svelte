<script lang="ts">
	import {
		arrowHead,
		dashArray,
		lineEnds,
		sketchLine,
		STROKE_WIDTH,
		type LineShape
	} from '../index.ts';
	import type { ShapeViewProps } from './plugin.ts';

	/**
	 * LineView: a line or an arrow, as pen strokes (`sketch`) or as exact lines (`precise`). Its
	 * ends come from `lineEnds`, so an attached end follows its shape.
	 */
	let { shape, editor }: ShapeViewProps<LineShape> = $props();

	const ends = $derived(lineEnds(editor, shape));
	const dx = $derived(ends.end.x - ends.start.x);
	const dy = $derived(ends.end.y - ends.start.y);
	const arrow = $derived(shape.props.arrow);
	const stroke = $derived(STROKE_WIDTH[shape.style.size]);
	const sketch = $derived(
		shape.style.look === 'sketch' ? sketchLine(dx, dy, stroke, shape.id, arrow) : ''
	);
	const head = $derived(arrow && !sketch ? arrowHead(dx, dy, stroke) : []);
</script>

<svg class="kd-svg">
	<g transform="translate({ends.start.x} {ends.start.y})">
		{#if sketch}
			<path class="kd-ink" d={sketch} />
		{:else}
			<path
				class="kd-fill kd-line"
				stroke-width={stroke}
				stroke-linecap="round"
				stroke-dasharray={dashArray(shape.style.look, stroke)}
				d="M0,0L{dx},{dy}"
			/>
			{#if head.length > 0}
				<path
					class="kd-fill kd-line"
					stroke-width={stroke}
					stroke-linecap="round"
					d={head.map(([from]) => `M${from.x},${from.y}L${dx},${dy}`).join('')}
				/>
			{/if}
		{/if}
	</g>
</svg>
