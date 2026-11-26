<!-- The whole whiteboard at a fixed size, on an editor the test owns. -->
<script lang="ts">
	import '../src/app.css';
	import type { Editor } from 'svelte-draw';
	import { Whiteboard } from '../src/lib/ui';

	let { editor, scheme }: { editor: Editor; scheme?: 'light' | 'dark' | 'auto' } = $props();
</script>

<div style:width="800px" style:height="600px">
	<Whiteboard {editor} {scheme} />
</div>
