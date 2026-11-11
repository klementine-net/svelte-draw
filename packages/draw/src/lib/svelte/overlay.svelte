<script lang="ts">
	import { box, vec, type Editor, type Vec } from '../index.ts';

	/**
	 * What sits on top of the shapes and never zooms: the hover and selection outlines, the
	 * selection box with its handles (or a line's two ends), the handle that turns the
	 * selection, the guides of a snap, the marquee. Drawn in screen space, so a line is a pixel
	 * wide and a handle is the same size at every zoom.
	 */
	let { editor }: { editor: Editor } = $props();

	const camera = $derived(editor.camera.get());
	const selecting = $derived(editor.tool === 'select');
	const selected = $derived(editor.getSelectedShapes());
	const hovered = $derived.by(() => {
		const id = editor.hovered.get();
		return id && !editor.selection.get().includes(id) ? editor.getShape(id) : undefined;
	});
	const outlined = $derived(hovered ? [...selected, hovered] : selected);

	const toScreen = (p: Vec): Vec => ({
		x: p.x * camera.z + camera.x,
		y: p.y * camera.z + camera.y
	});

	// The box the handles sit on: turned with a lone turned shape, upright around several.
	const frame = $derived(selecting ? editor.getSelectionFrame() : undefined);
	const degrees = $derived(((frame?.rotation ?? 0) * 180) / Math.PI);
	const corners = $derived(
		frame
			? box.corners(frame.bounds).map((corner) => toScreen(vec.rotate(corner, frame.rotation)))
			: []
	);
	const handles = $derived(frame && editor.canResizeSelection() ? corners : []);
	// The handle that turns the selection, and the stem that ties it to the box.
	const turn = $derived.by(() => {
		const handle = frame && !editor.editing.get() ? editor.getRotateHandle() : null;
		if (!frame || !handle) return undefined;
		const { bounds, rotation } = frame;
		const foot = vec.rotate({ x: bounds.x + bounds.w / 2, y: bounds.y }, rotation);
		return { handle: toScreen(handle), foot: toScreen(foot) };
	});
	// A lone shape's own handles (a line's ends), in place of the box's corners.
	const own = $derived(
		selecting
			? (editor.getShapeHandles()?.handles ?? []).map(({ id, x, y }) => ({
					id,
					...toScreen({ x, y })
				}))
			: []
	);
	const snaps = $derived(
		editor.snapLines.get().map(({ from, to }) => ({ from: toScreen(from), to: toScreen(to) }))
	);
	const brush = $derived.by(() => {
		const b = editor.brush.get();
		if (!b) return undefined;
		const at = toScreen(b);
		return { ...at, w: b.w * camera.z, h: b.h * camera.z };
	});
</script>

<svg class="kd-overlay" aria-hidden="true">
	{#each outlined as shape (shape.id)}
		{@const origin = editor.getShapePageOrigin(shape)}
		{@const turned = (editor.getShapePageRotation(shape) * 180) / Math.PI}
		<path
			class="kd-outline"
			d={editor.util(shape.kind).outline(shape)}
			transform="translate({camera.x} {camera.y}) scale({camera.z}) translate({origin.x} {origin.y}) rotate({turned})"
		/>
	{/each}
	{#if selected.length > 1 && corners.length > 0}
		<path class="kd-outline" d="M{corners.map(({ x, y }) => `${x},${y}`).join('L')}Z" />
	{/if}
	{#each snaps as { from, to }, i (i)}
		<line class="kd-snap" x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
	{/each}
	{#if turn}
		<line class="kd-stem" x1={turn.foot.x} y1={turn.foot.y} x2={turn.handle.x} y2={turn.handle.y} />
		<circle class="kd-handle" cx={turn.handle.x} cy={turn.handle.y} r="4.5" />
	{/if}
	{#each handles as { x, y }, i (i)}
		<rect
			class="kd-handle"
			x={x - 4}
			y={y - 4}
			width="8"
			height="8"
			rx="2"
			transform="rotate({degrees} {x} {y})"
		/>
	{/each}
	{#each own as handle (handle.id)}
		<circle class="kd-handle" cx={handle.x} cy={handle.y} r="4.5" />
	{/each}
	{#if brush}
		<rect class="kd-brush" x={brush.x} y={brush.y} width={brush.w} height={brush.h} />
	{/if}
</svg>
