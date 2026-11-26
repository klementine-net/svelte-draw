<!-- The canvas at a fixed size, on an editor the test owns. -->
<script lang="ts">
	import '../../src/lib/draw.css';
	import { Canvas, defaultPlugins, Minimap, type Editor } from '../../src/lib/index.ts';

	let {
		editor,
		width = 800,
		height = 600,
		scheme,
		minimap = false
	}: {
		editor: Editor;
		width?: number;
		height?: number;
		scheme?: 'light' | 'dark' | 'auto';
		minimap?: boolean;
	} = $props();
</script>

<div style:width="{width}px" style:height="{height}px">
	<Canvas {editor} plugins={defaultPlugins} label="Board" {scheme}>
		{#if minimap}<Minimap {editor} />{/if}
	</Canvas>
</div>
