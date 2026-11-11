<script lang="ts">
	import type { ImageShape } from '../index.ts';
	import type { ShapeViewProps } from './plugin.ts';

	/** ImageView: a picture, from the asset record the shape points at. */
	let { shape, editor }: ShapeViewProps<ImageShape> = $props();

	const asset = $derived.by(() => {
		const record = editor.store.get(shape.props.assetId);
		return record?.type === 'asset' ? record : undefined;
	});
</script>

{#if asset}
	<img
		class="kd-image"
		src={asset.src}
		alt={asset.name}
		width={shape.props.w}
		height={shape.props.h}
		draggable="false"
	/>
{:else}
	<!-- The file has not arrived (yet): its place is kept. -->
	<div
		class="kd-image kd-image-missing"
		style:width="{shape.props.w}px"
		style:height="{shape.props.h}px"
	></div>
{/if}
