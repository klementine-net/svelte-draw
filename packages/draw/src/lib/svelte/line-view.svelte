<script lang="ts">
	import {
		arrowHead,
		dashArray,
		FONT_SIZE,
		lineGeometry,
		sketchLine,
		sketchPolyline,
		STROKE_WIDTH,
		type LineShape,
		type Vec
	} from '../index.ts';
	import type { ShapeViewProps } from './plugin.ts';
	import TextLabel from './text-label.svelte';

	/**
	 * LineView: a line or an arrow, straight or bent, as pen strokes (`sketch`) or as exact
	 * lines. Its run comes from `lineGeometry`, so an attached end follows its shape.
	 */
	let { shape, editor }: ShapeViewProps<LineShape> = $props();

	const line = $derived(lineGeometry(editor, shape));
	const stroke = $derived(STROKE_WIDTH[shape.style.size]);
	const isSketch = $derived(shape.style.look === 'sketch');
	const shaft = $derived.by(() => {
		if (!isSketch) return '';
		// A right-angled line is drawn stretch by stretch, so its corners stay corners.
		if (shape.props.elbow)
			return line.points
				.slice(1)
				.map((point, i) => sketchPolyline([line.points[i], point], stroke, `${shape.id}:${i}`))
				.join('');
		if (line.points.length > 2) return sketchPolyline(line.points, stroke, shape.id);
		// A straight one is drawn from its start, then moved there.
		return sketchLine(
			line.end.x - line.start.x,
			line.end.y - line.start.y,
			stroke,
			shape.id,
			false
		);
	});
	/** The two barbs of a head at `tip`, for a line arriving there from `from`. */
	const barbs = (from: Vec, tip: Vec): Vec[][] =>
		arrowHead(tip.x - from.x, tip.y - from.y, stroke).map(([barb]) => [
			{ x: barb.x + from.x, y: barb.y + from.y },
			tip
		]);
	const heads = $derived([
		...(shape.props.arrow ? barbs(line.from.end, line.end) : []),
		...(shape.props.arrowStart ? barbs(line.from.start, line.start) : [])
	]);
	const labelled = $derived(!!shape.props.text || editor.editing.get() === shape.id);
</script>

<svg class="kd-svg">
	{#if isSketch}
		<path
			class="kd-ink"
			d={shaft}
			transform={line.points.length > 2 ? undefined : `translate(${line.start.x} ${line.start.y})`}
		/>
		{#each heads as barb, i (i)}
			<path class="kd-ink" d={sketchPolyline(barb, stroke, `${shape.id}:head:${i}`)} />
		{/each}
	{:else}
		<path
			class="kd-fill kd-line"
			stroke-width={stroke}
			style:fill="none"
			stroke-linecap="round"
			stroke-dasharray={dashArray(shape.style.look, stroke)}
			d={line.path}
		/>
		{#each heads as [from, tip], i (i)}
			<path
				class="kd-fill kd-line"
				stroke-width={stroke}
				stroke-linecap="round"
				d="M{from.x},{from.y}L{tip.x},{tip.y}"
			/>
		{/each}
	{/if}
</svg>
{#if labelled}
	<!-- The words sit on the middle of the line, on a patch of canvas so the line does not cross them. -->
	<div
		class="kd-label kd-line-label"
		data-font={shape.style.font ?? 'hand'}
		style:left="{line.middle.x}px"
		style:top="{line.middle.y}px"
		style:--kd-font-size="{FONT_SIZE[shape.style.size] * 0.8}px"
	>
		<TextLabel
			{editor}
			{shape}
			text={shape.props.text ?? ''}
			onchange={(text) => editor.updateShape(shape.id, { props: { text } })}
		/>
	</div>
{/if}
