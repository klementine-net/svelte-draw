<script lang="ts">
	import { untrack } from 'svelte';
	import { broadcastChannel, Editor, indexedDbStorage, persist } from '@simon-lund/svelte-draw';
	import {
		Canvas,
		deepLink,
		defaultPlugins,
		Minimap,
		type DrawSveltePlugin
	} from '@simon-lund/svelte-draw/svelte';
	import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from '@klementine/ui/context-menu';
	import { defaultLabels, type DrawLabels } from './labels.ts';
	import CanvasMenu from './canvas-menu.svelte';
	import DrawToolbar from './draw-toolbar.svelte';
	import StylePanel from './style-panel.svelte';
	import ZoomControl from './zoom-control.svelte';
	import PageMenu from './page-menu.svelte';

	/**
	 * Whiteboard: a whole whiteboard in one tag: the library's canvas with this example's
	 * controls around it (toolbar, style panel, page menu, zoom control, right-click menu), and
	 * the board kept in the browser. Fills its parent: give the parent a size.
	 *
	 * `plugins` decide what it can do (the built-in ones by default; add your own shapes and
	 * tools to the list). Pass an `editor` to own it (to script it, save it, or sync its store);
	 * otherwise it makes one. For another arrangement, compose `Canvas` and the parts yourself.
	 *
	 * @example
	 * <div class="h-dvh"><Whiteboard persistenceKey="my-board" /></div>
	 */
	let props: {
		plugins?: DrawSveltePlugin[];
		editor?: Editor;
		labels?: DrawLabels;
		/**
		 * Keeps the document in this browser under this name and in step with the other tabs
		 * that show it. Without it, the document lives only as long as the page.
		 */
		persistenceKey?: string;
		/** How this user shows to the other tabs (with `persistenceKey`): a name, a colour. */
		user?: { name?: string; color?: string };
		/** Fills a board that was never saved (with `persistenceKey`): a first picture. */
		seed?: (editor: Editor) => void;
		/** Look, don't touch: the view can be moved, nothing can be changed. */
		readOnly?: boolean;
		/** Nothing but the canvas: no toolbar, panels or menus (keys and the right-click menu stay). */
		focus?: boolean;
		/** Shows the small map of the page in the bottom right corner. */
		minimap?: boolean;
		/** Keeps the page and the view in the address, so a copied link opens where it was. */
		deepLinks?: boolean;
	} = $props();

	// Plugins are fixed for an editor's life: a tool tree is built once.
	const plugins = untrack(() => props.plugins ?? defaultPlugins);
	const editor = untrack(() => props.editor ?? new Editor({ plugins }));
	const labels = $derived(props.labels ?? defaultLabels);
	const readOnly = $derived(editor.readOnly.get());
	/** The canvas's surface, for the menu's copy of the selection as a picture. */
	let surface = $state<HTMLElement | null>(null);

	$effect(() => editor.setReadOnly(props.readOnly ?? false));
	// Without storage the address is read at once; with it, once the board is loaded (below).
	$effect(() => (props.deepLinks && !props.persistenceKey ? deepLink(editor) : undefined));

	$effect(() => {
		const key = props.persistenceKey;
		if (!key) return;
		const links = untrack(() => props.deepLinks);
		let stop: (() => void) | undefined;
		let gone = false;
		void persist(editor, {
			storage: indexedDbStorage(key),
			channel: broadcastChannel(key),
			seed: untrack(() => props.seed),
			user: untrack(() => props.user),
			saveDelay: 300
		}).then((end) => {
			if (gone) return end();
			// Only now does the page the address names exist.
			const stopLinks = links ? deepLink(editor) : undefined;
			stop = () => {
				end();
				stopLinks?.();
			};
		});
		return () => {
			gone = true;
			stop?.();
		};
	});
</script>

<!-- The theme follows the system, so the canvas does. -->
<Canvas {editor} {plugins} label={labels.canvas} scheme="auto">
	<!-- The right-click menu: its trigger goes around the canvas's surface. -->
	{#snippet around(canvas)}
		<ContextMenu>
			<ContextMenuTrigger bind:ref={surface}>
				{#snippet child({ props })}{@render canvas(props)}{/snippet}
			</ContextMenuTrigger>
			<ContextMenuContent><CanvasMenu {editor} {labels} canvas={surface} /></ContextMenuContent>
		</ContextMenu>
	{/snippet}
	{#if !props.focus}
		<PageMenu {editor} {labels} class="absolute top-3 left-3" />
	{/if}
	{#if !readOnly && !props.focus}
		<StylePanel {editor} {labels} class="absolute top-3 right-3" />
		<DrawToolbar {editor} {plugins} {labels} class="absolute bottom-3 left-1/2 -translate-x-1/2" />
	{/if}
	{#if !props.focus}
		<ZoomControl {editor} {labels} class="absolute bottom-3 left-3" />
	{/if}
	{#if props.minimap && !props.focus}
		<Minimap {editor} label={labels.minimap} class="absolute right-3 bottom-3" />
	{/if}
</Canvas>
