<script lang="ts">
	import {
		dashArray,
		FONT_SIZE,
		geoMarks,
		geoPath,
		geoPoints,
		sketchEllipse,
		sketchLoop,
		sketchPolygon,
		sketchPolyline,
		SMOOTH,
		STROKE_WIDTH,
		type GeoShape
	} from '../core.ts';
	import type { ShapeViewProps } from './plugin.ts';
	import TextLabel from './text-label.svelte';

	/**
	 * GeoView: a closed shape in a box (rectangle, ellipse, star, …), as a pen stroke (`sketch`)
	 * or as exact lines, with the words written in it.
	 */
	let { shape, editor }: ShapeViewProps<GeoShape> = $props();

	const { geo, w, h } = $derived(shape.props);
	const stroke = $derived(STROKE_WIDTH[shape.style.size]);
	const isSketch = $derived(shape.style.look === 'sketch');
	const path = $derived(geoPath(geo, w, h));
	const sketch = $derived.by(() => {
		if (!isSketch) return '';
		if (geo === 'ellipse') return sketchEllipse(w, h, stroke, shape.id);
		const points = geoPoints(geo, w, h);
		return SMOOTH.has(geo)
			? sketchLoop(points, stroke, shape.id)
			: sketchPolygon(points, stroke, shape.id);
	});
	const marks = $derived(geoMarks(geo, w, h));
	const dash = $derived(dashArray(shape.style.look, stroke));
	const labelled = $derived(!!shape.props.text || editor.editing.get() === shape.id);
</script>

<svg class="kd-svg" data-fill={shape.style.fill}>
	{#if shape.style.fill === 'pattern'}
		<!-- Hatching in the shape's colour; the id is the shape's, so each shape has its own. -->
		<defs>
			<pattern
				id="kd-hatch-{shape.id}"
				width="8"
				height="8"
				patternUnits="userSpaceOnUse"
				patternTransform="rotate(45)"
			>
				<line class="kd-hatch" x1="0" y1="0" x2="0" y2="8" />
			</pattern>
		</defs>
	{/if}
	<path
		class={isSketch ? 'kd-fill' : 'kd-fill kd-line'}
		style:fill={shape.style.fill === 'pattern'
			? `url(#kd-hatch-${CSS.escape(shape.id)})`
			: undefined}
		d={path}
		stroke-width={stroke}
		stroke-dasharray={dash}
		stroke-linecap="round"
	/>
	{#if sketch}<path class="kd-ink" d={sketch} />{/if}
	{#each marks as mark, i (i)}
		{#if isSketch}
			<path class="kd-ink" d={sketchPolyline(mark, stroke, `${shape.id}:${i}`)} />
		{:else}
			<path
				class="kd-line"
				fill="none"
				d="M{mark.map(({ x, y }) => `${x},${y}`).join('L')}"
				stroke-width={stroke}
				stroke-dasharray={dash}
				stroke-linecap="round"
			/>
		{/if}
	{/each}
</svg>
{#if labelled}
	<div
		class="kd-label kd-geo-label"
		data-font={shape.style.font ?? 'hand'}
		data-align={shape.style.align ?? 'middle'}
		data-valign={shape.style.valign ?? 'middle'}
		data-fill={shape.style.fill}
		style:width="{w}px"
		style:height="{h}px"
		style:--kd-font-size="{FONT_SIZE[shape.style.size]}px"
	>
		<TextLabel
			{editor}
			{shape}
			text={shape.props.text ?? ''}
			onchange={(text) => editor.updateShape(shape.id, { props: { text } })}
		/>
	</div>
{/if}
