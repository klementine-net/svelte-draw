<script lang="ts">
	import type { Editor } from '../index.ts';
	import type { ShapeView } from './plugin.ts';

	/** One shape on the canvas: placed at its page origin, drawn by its kind's view. */
	let { id, editor, views }: { id: string; editor: Editor; views: Record<string, ShapeView> } =
		$props();

	const shape = $derived(editor.getShape(id));
	const origin = $derived(shape ? editor.getShapePageOrigin(shape) : { x: 0, y: 0 });
	const View = $derived(shape ? views[shape.kind] : undefined);
</script>

{#if shape && View}
	<div
		class="kd-shape"
		data-kind={shape.kind}
		data-color={shape.style.color}
		style:transform="translate({origin.x}px, {origin.y}px)"
	>
		<View {shape} {editor} />
	</div>
{/if}
