<script lang="ts">
	import { box, type Editor } from '../index.ts';
	import { defaultLabels, type DrawLabels } from './labels.ts';

	/**
	 * Minimap: the whole page small, with the part on screen marked. Press or drag in it to
	 * go there.
	 *
	 * @example
	 * <Minimap {editor} class="absolute right-3 bottom-3" />
	 */
	let {
		editor,
		labels = defaultLabels,
		class: className
	}: { editor: Editor; labels?: DrawLabels; class?: string } = $props();

	const WIDTH = 168;
	const HEIGHT = 112;

	const view = $derived(editor.getViewportPageBounds());
	const shapes = $derived(
		editor
			.getShapes()
			.filter((shape) => !editor.util(shape.kind).group)
			.map((shape) => ({
				id: shape.id,
				color: shape.style.color,
				...editor.getShapePageBounds(shape)
			}))
	);
	// Everything on the page and the view itself, with a little air around.
	const world = $derived.by(() => {
		const all = box.union([view, ...shapes]) ?? view;
		const pad = Math.max(all.w, all.h) * 0.06;
		return { x: all.x - pad, y: all.y - pad, w: all.w + pad * 2, h: all.h + pad * 2 };
	});

	function go(event: PointerEvent) {
		const rect = (event.currentTarget as SVGElement).getBoundingClientRect();
		const scale = Math.max(world.w / rect.width, world.h / rect.height);
		// The picture is centred in the box: take the slack on each side into account.
		const x = world.x + world.w / 2 + (event.clientX - rect.left - rect.width / 2) * scale;
		const y = world.y + world.h / 2 + (event.clientY - rect.top - rect.height / 2) * scale;
		const { w, h } = editor.viewport.peek();
		const { z } = editor.camera.peek();
		editor.camera.set({ x: w / 2 - x * z, y: h / 2 - y * z, z });
	}
</script>

<div class={['rounded-lg bg-layer p-1 shadow-float', className]}>
	<svg
		class="kd-minimap"
		role="img"
		aria-label={labels.minimap}
		width={WIDTH}
		height={HEIGHT}
		viewBox="{world.x} {world.y} {world.w} {world.h}"
		onpointerdown={(event) => {
			event.currentTarget.setPointerCapture(event.pointerId);
			go(event);
		}}
		onpointermove={(event) => {
			if (event.buttons === 1) go(event);
		}}
	>
		{#each shapes as shape (shape.id)}
			<rect
				class="kd-minimap-shape"
				data-color={shape.color}
				x={shape.x}
				y={shape.y}
				width={Math.max(shape.w, world.w / 120)}
				height={Math.max(shape.h, world.w / 120)}
			/>
		{/each}
		<rect class="kd-minimap-view" x={view.x} y={view.y} width={view.w} height={view.h} />
	</svg>
</div>
