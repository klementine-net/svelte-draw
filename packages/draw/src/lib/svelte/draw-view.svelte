<script lang="ts">
	import { inkPath, inkSize, type DrawShape } from '../index.ts';
	import type { ShapeViewProps } from './plugin.ts';

	/**
	 * DrawView: one freehand stroke, filled as the outline of where the pen went. A
	 * highlighter's stroke is a wide, even, see-through line instead.
	 */
	let { shape }: ShapeViewProps<DrawShape> = $props();

	const d = $derived(
		shape.props.highlight
			? `M${shape.props.points.map(([x, y]) => `${x},${y}`).join('L')}${shape.props.points.length === 1 ? 'h0.01' : ''}`
			: inkPath(shape.props.points, inkSize(shape), shape.props.pen, shape.props.done)
	);
</script>

<svg class="kd-svg">
	{#if shape.props.highlight}
		<path class="kd-highlight" {d} stroke-width={inkSize(shape)} />
	{:else}
		<path class="kd-ink" {d} />
	{/if}
</svg>
