<script lang="ts">
	import { sketchEllipse, sketchRectangle, STROKE_WIDTH, type GeoShape } from '../index.ts';
	import type { ShapeViewProps } from './plugin.ts';

	/** GeoView: a rectangle or ellipse, as a pen stroke (`sketch`) or as exact lines (`precise`). */
	let { shape }: ShapeViewProps<GeoShape> = $props();

	const w = $derived(shape.props.w);
	const h = $derived(shape.props.h);
	const stroke = $derived(STROKE_WIDTH[shape.style.size]);
	const sketch = $derived(
		shape.style.look !== 'sketch'
			? ''
			: shape.props.geo === 'ellipse'
				? sketchEllipse(w, h, stroke, shape.id)
				: sketchRectangle(w, h, stroke, shape.id)
	);
</script>

<svg class="kd-svg" data-fill={shape.style.fill}>
	{#if shape.props.geo === 'ellipse'}
		<ellipse
			class={sketch ? 'kd-fill' : 'kd-fill kd-line'}
			cx={w / 2}
			cy={h / 2}
			rx={w / 2}
			ry={h / 2}
			stroke-width={stroke}
		/>
	{:else}
		<rect
			class={sketch ? 'kd-fill' : 'kd-fill kd-line'}
			width={w}
			height={h}
			rx={sketch ? stroke : 0}
			stroke-width={stroke}
		/>
	{/if}
	{#if sketch}<path class="kd-ink" d={sketch} />{/if}
</svg>
