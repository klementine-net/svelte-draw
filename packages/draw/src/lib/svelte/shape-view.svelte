<script lang="ts">
	import { box, type Editor } from '../core.ts';
	import type { ShapeView } from './plugin.ts';

	/**
	 * One shape on the canvas: placed at its page origin and turned as it is on the page, drawn
	 * by its kind's view. What sits in a frame is cut off at the frame's edge.
	 */
	let { id, editor, views }: { id: string; editor: Editor; views: Record<string, ShapeView> } =
		$props();

	const shape = $derived(editor.getShape(id));
	const origin = $derived(shape ? editor.getShapePageOrigin(shape) : { x: 0, y: 0 });
	const rotation = $derived(shape ? editor.getShapePageRotation(shape) : 0);
	const View = $derived(shape ? views[shape.kind] : undefined);
	// A shape the eraser has touched fades until the eraser lets go.
	const erasing = $derived(editor.erasing.get().includes(id));

	const clip = $derived.by(() => {
		if (!shape) return undefined;
		for (let parent = editor.getShape(shape.parentId); parent;) {
			const frame = parent;
			const util = editor.util(frame.kind);
			if (util.frame) {
				// The frame's corners, in this shape's own space.
				const corners = box
					.corners(util.bounds(frame))
					.map((corner) => editor.pageToShape(shape, editor.shapeToPage(frame, corner)));
				return `polygon(${corners.map(({ x, y }) => `${x}px ${y}px`).join(', ')})`;
			}
			parent = editor.getShape(frame.parentId);
		}
		return undefined;
	});
</script>

{#if shape && View}
	<div
		class="kd-shape"
		data-id={shape.id}
		data-kind={shape.kind}
		data-color={shape.style.color}
		style:transform="translate({origin.x}px, {origin.y}px) rotate({rotation}rad)"
		style:opacity={(shape.style.opacity ?? 1) * (erasing ? 0.25 : 1)}
		style:clip-path={clip}
	>
		<View {shape} {editor} />
	</div>
{/if}
