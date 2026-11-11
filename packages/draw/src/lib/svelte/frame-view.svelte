<script lang="ts">
	import type { FrameShape } from '../index.ts';
	import type { ShapeViewProps } from './plugin.ts';
	import TextLabel from './text-label.svelte';

	/** FrameView: a frame's box, with its name above the top left corner. */
	let { shape, editor }: ShapeViewProps<FrameShape> = $props();
</script>

<div class="kd-frame" style:width="{shape.props.w}px" style:height="{shape.props.h}px"></div>
<div class="kd-frame-name" style:max-width="{shape.props.w}px">
	<TextLabel
		{editor}
		{shape}
		text={shape.props.name}
		onchange={(name) => editor.updateShape(shape.id, { props: { name } })}
	/>
</div>
