<script lang="ts">
	import { inkPath, inkSize, type DrawShape } from '../index.ts';
	import type { ShapeViewProps } from './plugin.ts';

	/** DrawView: one freehand stroke, filled as the outline of where the pen went. */
	let { shape }: ShapeViewProps<DrawShape> = $props();

	const d = $derived(
		inkPath(shape.props.points, inkSize(shape), shape.props.pen, shape.props.done)
	);
</script>

<svg class="kd-svg"><path class="kd-ink" {d} /></svg>
