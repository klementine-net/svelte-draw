<script lang="ts">
	import type { Snippet } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';
	import { box, Canvas, type DrawSveltePlugin, type Editor } from '@klementine/svelte-draw';
	// The toolbar is the whiteboard example's: the library brings no controls.
	import { DrawToolbar } from 'svelte-draw-example-whiteboard/ui';

	/**
	 * LiveCanvas: a real Draw canvas set into a page. It does not take the page's scrolling until
	 * someone works on it: before that, the wheel and a swiping finger scroll the page as anywhere
	 * else; a press on the canvas makes it the canvas's, a press elsewhere gives it back.
	 *
	 * `plugins` are the editor's; `tools`, if given, are the fewer ones the toolbar shows on a
	 * phone. `fit` shows everything on the board once the canvas has its size. `children` sit above
	 * the canvas (a button bar of an example).
	 */
	let {
		editor,
		plugins,
		tools,
		label,
		fit = true,
		class: className,
		children
	}: {
		editor: Editor;
		plugins: DrawSveltePlugin[];
		tools?: DrawSveltePlugin[];
		label: string;
		fit?: boolean;
		class?: string;
		children?: Snippet;
	} = $props();

	const compact = new MediaQuery('max-width: 599px');
	let root = $state<HTMLElement | null>(null);
	let active = $state(false);

	// Until someone works on the board, it shows all of it, as large as fits above the toolbar and
	// never larger than life, also when the canvas changes size (a phone turned, a window resized).
	let touched = false;
	$effect(() => {
		const { w, h } = editor.viewport.get();
		if (touched || !fit || w === 0 || h === 0) return;
		const bounds = box.union(editor.getShapes().map((shape) => editor.getShapePageBounds(shape)));
		if (!bounds) return;
		const margin = 20;
		const toolbar = 72;
		const z = Math.min(1, (w - margin * 2) / bounds.w, (h - margin - toolbar) / bounds.h);
		const middle = box.center(bounds);
		editor.camera.set({ x: w / 2 - middle.x * z, y: (h - toolbar + margin) / 2 - middle.y * z, z });
	});

	// A press anywhere else gives the page its scrolling back.
	$effect(() => {
		if (!active) return;
		const away = (event: PointerEvent) => {
			if (root && !root.contains(event.target as Node)) active = false;
		};
		document.addEventListener('pointerdown', away, true);
		return () => document.removeEventListener('pointerdown', away, true);
	});
</script>

<!-- The wheel reaches the canvas only once it is being worked on, or to zoom (Ctrl). -->
<div
	bind:this={root}
	class={['live-canvas relative overflow-hidden', className]}
	data-active={active || undefined}
	onpointerdowncapture={() => (active = touched = true)}
	onwheelcapture={(event) => {
		if (!active && !event.ctrlKey) event.stopPropagation();
	}}
>
	<Canvas {editor} {plugins} {label} scheme="auto">
		<DrawToolbar
			{editor}
			plugins={compact.current && tools ? tools : plugins}
			class="absolute bottom-3 left-1/2 -translate-x-1/2"
		/>
		{@render children?.()}
	</Canvas>
</div>

<style>
	/* Until it is worked on, a finger swiping across the canvas scrolls the page. */
	.live-canvas:not([data-active]) :global(.kd-surface) {
		touch-action: pan-y;
	}
	/* The canvas is the page's own paper: the dots show where it is, no box around it. */
	.live-canvas :global(.kd-root) {
		background: transparent;
	}
</style>
