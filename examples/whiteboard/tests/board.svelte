<!-- The whole whiteboard at a fixed size, on an editor the test owns. -->
<script lang="ts">
	import '../src/app.css';
	import type { Editor } from '@simon-lund/svelte-draw';
	import { Whiteboard } from '../src/lib/ui/index.ts';

	let { editor, scheme }: { editor: Editor; scheme?: 'light' | 'dark' | 'auto' } = $props();
</script>

<div style:width="800px" style:height="600px">
	<Whiteboard {editor} {scheme} />
</div>
