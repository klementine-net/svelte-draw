<script lang="ts">
	import type { Editor } from '../index.ts';

	/**
	 * What sits on top of the shapes and never zooms: the hover and selection outlines, the
	 * selection box with its handles, the marquee. Drawn in screen space, so a line is a pixel
	 * wide and a handle is the same size at every zoom.
	 */
	let { editor }: { editor: Editor } = $props();

	const camera = $derived(editor.camera.get());
	const selected = $derived(editor.getSelectedShapes());
	const hovered = $derived.by(() => {
		const id = editor.hovered.get();
		return id && !editor.selection.get().includes(id) ? editor.getShape(id) : undefined;
	});
	const outlined = $derived(hovered ? [...selected, hovered] : selected);

	const toScreen = (b: { x: number; y: number; w: number; h: number }) => ({
		x: b.x * camera.z + camera.x,
		y: b.y * camera.z + camera.y,
		w: b.w * camera.z,
		h: b.h * camera.z
	});

	const bounds = $derived.by(() => {
		const b = editor.getSelectionBounds();
		return b && editor.tool === 'select' ? toScreen(b) : undefined;
	});
	const handles = $derived(
		bounds && editor.canResizeSelection()
			? [
					[bounds.x, bounds.y],
					[bounds.x + bounds.w, bounds.y],
					[bounds.x + bounds.w, bounds.y + bounds.h],
					[bounds.x, bounds.y + bounds.h]
				]
			: []
	);
	const brush = $derived.by(() => {
		const b = editor.brush.get();
		return b ? toScreen(b) : undefined;
	});
</script>

<svg class="kd-overlay" aria-hidden="true">
	{#each outlined as shape (shape.id)}
		{@const origin = editor.getShapePageOrigin(shape)}
		<path
			class="kd-outline"
			d={editor.util(shape.kind).outline(shape)}
			transform="translate({camera.x} {camera.y}) scale({camera.z}) translate({origin.x} {origin.y})"
		/>
	{/each}
	{#if bounds && selected.length > 1}
		<rect class="kd-outline" x={bounds.x} y={bounds.y} width={bounds.w} height={bounds.h} />
	{/if}
	{#each handles as [x, y], i (i)}
		<rect class="kd-handle" x={x - 4} y={y - 4} width="8" height="8" rx="2" />
	{/each}
	{#if brush}
		<rect class="kd-brush" x={brush.x} y={brush.y} width={brush.w} height={brush.h} />
	{/if}
</svg>
