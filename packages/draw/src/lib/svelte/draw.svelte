<script lang="ts">
	import { untrack } from 'svelte';
	import { Editor } from '../index.ts';
	import { defaultPlugins, type DrawSveltePlugin } from './plugin.ts';
	import { defaultLabels, type DrawLabels } from './labels.ts';
	import Canvas from './canvas.svelte';
	import DrawToolbar from './draw-toolbar.svelte';
	import StylePanel from './style-panel.svelte';
	import ZoomControl from './zoom-control.svelte';

	/**
	 * Draw: the whole whiteboard in one tag: the canvas, the toolbar, the style panel and the
	 * zoom control. Fills its parent: give the parent a size.
	 *
	 * `plugins` decide what it can do (the built-in ones by default; add your own shapes and
	 * tools to the list). Pass an `editor` to own it (to script it, save it, or sync its store);
	 * otherwise Draw makes one. For another arrangement, compose `Canvas` and the parts yourself.
	 *
	 * @example
	 * <div class="h-dvh"><Draw /></div>
	 */
	let props: { plugins?: DrawSveltePlugin[]; editor?: Editor; labels?: DrawLabels } = $props();

	// Plugins are fixed for an editor's life: a tool tree is built once.
	const plugins = untrack(() => props.plugins ?? defaultPlugins);
	const editor = untrack(() => props.editor ?? new Editor({ plugins }));
	const labels = $derived(props.labels ?? defaultLabels);
</script>

<Canvas {editor} {plugins} {labels} label={labels.canvas}>
	<StylePanel {editor} {labels} class="absolute top-3 right-3" />
	<ZoomControl {editor} {labels} class="absolute bottom-3 left-3" />
	<DrawToolbar {editor} {plugins} {labels} class="absolute bottom-3 left-1/2 -translate-x-1/2" />
</Canvas>
