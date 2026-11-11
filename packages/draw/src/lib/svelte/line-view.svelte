<script lang="ts">
	import { arrowHead, sketchLine, STROKE_WIDTH, type LineShape } from '../index.ts';
	import type { ShapeViewProps } from './plugin.ts';

	/** LineView: a line or an arrow, as pen strokes (`sketch`) or as exact lines (`precise`). */
	let { shape }: ShapeViewProps<LineShape> = $props();

	const { dx, dy, arrow } = $derived(shape.props);
	const stroke = $derived(STROKE_WIDTH[shape.style.size]);
	const sketch = $derived(
		shape.style.look === 'sketch' ? sketchLine(dx, dy, stroke, shape.id, arrow) : ''
	);
	const head = $derived(arrow && !sketch ? arrowHead(dx, dy, stroke) : []);
</script>

<svg class="kd-svg">
	{#if sketch}
		<path class="kd-ink" d={sketch} />
	{:else}
		<path
			class="kd-fill kd-line"
			stroke-width={stroke}
			stroke-linecap="round"
			d="M0,0L{dx},{dy}{head.map(([from]) => `M${from.x},${from.y}L${dx},${dy}`).join('')}"
		/>
	{/if}
</svg>
