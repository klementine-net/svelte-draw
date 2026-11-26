<script lang="ts">
	import { untrack } from 'svelte';
	import { createAttachmentKey } from 'svelte/attachments';
	import { broadcastChannel, Editor, indexedDbStorage, persist } from 'svelte-draw';
	import {
		Canvas,
		deepLink,
		defaultPlugins,
		Minimap,
		type DrawSveltePlugin
	} from 'svelte-draw/svelte';
	import { ContextMenu } from 'bits-ui';
	import { defaultLabels, type DrawLabels } from './labels';
	import CanvasMenu from './canvas-menu.svelte';
	import DrawToolbar from './draw-toolbar.svelte';
	import StylePanel from './style-panel.svelte';
	import ZoomControl from './zoom-control.svelte';
	import PageMenu from './page-menu.svelte';
	import { holdForMenu, setScheme, toCanvas, type Scheme } from './board';

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
		/** Light or dark, for the canvas and the controls; `auto` (the default) follows the system. */
		scheme?: Scheme;
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
	const scheme = $derived(props.scheme ?? 'auto');
	// Menus and hints are drawn outside the board: they learn the scheme from here.
	setScheme(() => scheme);
	// A finger resting on the canvas opens the menu, as a right click does.
	const hold = { [createAttachmentKey()]: holdForMenu };
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

<!-- The board's width decides how the controls are arranged, not the window's. -->
<div class="board">
	<Canvas {editor} {plugins} label={labels.canvas} {scheme}>
		<!-- The right-click menu: its trigger goes around the canvas's surface. -->
		{#snippet around(canvas)}
			<ContextMenu.Root>
				<ContextMenu.Trigger bind:ref={surface}>
					{#snippet child({ props })}{@render canvas({ ...props, ...hold })}{/snippet}
				</ContextMenu.Trigger>
				<ContextMenu.Portal>
					<ContextMenu.Content
						collisionPadding={8}
						class="wb wb-menu"
						data-scheme={scheme}
						onCloseAutoFocus={(event) => toCanvas(event, surface)}
					>
						<CanvasMenu {editor} {labels} canvas={surface} />
					</ContextMenu.Content>
				</ContextMenu.Portal>
			</ContextMenu.Root>
		{/snippet}
		<!-- The controls lie above the surface, each in its corner. -->
		{#if !props.focus}
			<div class="at top-left"><PageMenu {editor} {labels} /></div>
			<div class="at bottom-left"><ZoomControl {editor} {labels} /></div>
			{#if !readOnly}
				<div class="at top-right"><StylePanel {editor} {labels} /></div>
				<div class="at bottom"><DrawToolbar {editor} {plugins} {labels} /></div>
			{/if}
			{#if props.minimap}
				<div class="at bottom-right"><Minimap {editor} label={labels.minimap} /></div>
			{/if}
		{/if}
	</Canvas>
</div>

<style>
	.board {
		width: 100%;
		height: 100%;
		container-type: inline-size;
	}
	.at {
		position: absolute;
	}
	.top-left {
		top: 12px;
		left: 12px;
	}
	.top-right {
		top: 12px;
		right: 12px;
	}
	.bottom-left {
		bottom: 12px;
		left: 12px;
	}
	.bottom-right {
		right: 12px;
		bottom: 12px;
	}
	/* The tools: in the middle of the bottom edge, and never wider than the board. */
	.bottom {
		bottom: 12px;
		left: 50%;
		translate: -50%;
		max-width: calc(100% - 24px);
	}

	/* A narrow board (a phone): the tools get the bottom edge to themselves and scroll sideways.
	   Zooming is a pinch there, and the map would cover the page it shows. */
	@container (max-width: 599px) {
		.bottom-left,
		.bottom-right {
			display: none;
		}
		.bottom {
			/* Room for the bar's shadow inside the scrolling box. */
			bottom: 0;
			max-width: 100%;
			padding: 12px;
			box-sizing: border-box;
			overflow-x: auto;
			scrollbar-width: none;
		}
	}
</style>
