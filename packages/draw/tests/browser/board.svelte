<!-- The canvas at a fixed size, on an editor the test owns. -->
<script lang="ts">
	import '../../src/lib/draw.css';
	import type { Editor } from '../../src/lib/index.ts';
	import { Canvas, defaultPlugins } from '../../src/lib/svelte/index.ts';

	let {
		editor,
		width = 800,
		height = 600,
		scheme
	}: {
		editor: Editor;
		width?: number;
		height?: number;
		scheme?: 'light' | 'dark' | 'auto';
	} = $props();
</script>

<div style:width="{width}px" style:height="{height}px">
	<Canvas {editor} plugins={defaultPlugins} label="Board" {scheme} />
</div>
