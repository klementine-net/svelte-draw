<script lang="ts">
	import type { ShapeViewProps } from '@klementine/svelte-draw';
	import type { DotShape } from './dot.ts';

	// How a dot looks: drawn in its own space, the canvas puts it in place.
	let { shape }: ShapeViewProps<DotShape> = $props();
	const r = $derived(shape.props.r);
</script>

<svg class="kd-svg">
	<circle cx={r} cy={r} {r} fill="var(--kd-color)" />
</svg>
