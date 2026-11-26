<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Attachment } from 'svelte/attachments';
	import './reactive.ts';
	import type { Editor } from '../index.ts';
	import type { DrawSveltePlugin, ShapeView as View } from './plugin.ts';
	import ShapeView from './shape-view.svelte';
	import Overlay from './overlay.svelte';
	import { copyShapes, dropFiles, pasteInto } from './canvas/clipboard.ts';
	import {
		doubleClickInfo,
		inTextField,
		keyInfo,
		pointerInfo,
		selectForMenu,
		wheelInfo
	} from './canvas/input.ts';
	import { createPinch } from './canvas/pinch.ts';
	import { visibleShapeIds } from './canvas/visible.ts';

	/**
	 * Canvas: the surface an editor is shown and worked on. It draws the editor's shapes through
	 * the plugins' views, and turns pointer, wheel and key events into the editor's events;
	 * every decision about what an event means is the editor's and its tools'.
	 *
	 * `children` sit above the surface (a toolbar, a panel) and do not send it events. Name the
	 * canvas with `label`. Fills its parent: give the parent a size.
	 *
	 * Also the canvas's: copy, cut and paste through the system clipboard, and two-finger pinch
	 * and pan on a touch screen. The controls are the app's: the canvas brings none.
	 *
	 * `around` puts something around the surface, a context menu's trigger for one. It gets the
	 * surface as a snippet and renders it, handing over the attributes and handlers it wants on
	 * the element. The surface runs its own handler first and theirs after, unless the event was
	 * prevented. A right click selects what is under the pointer before any menu opens.
	 *
	 * @example
	 * <Canvas {editor} plugins={defaultPlugins} label="Whiteboard">
	 *   <MyToolbar {editor} />
	 * </Canvas>
	 */
	let {
		editor,
		plugins,
		label,
		around,
		children
	}: {
		editor: Editor;
		plugins: DrawSveltePlugin[];
		label: string;
		around?: Snippet<[Snippet<[SurfaceProps?]>]>;
		children?: Snippet;
	} = $props();

	/** What a wrapper hands the surface: attributes, handlers, attachments. */
	type SurfaceProps = Record<string | symbol, unknown>;

	const views = $derived(
		Object.assign({}, ...plugins.map((plugin) => plugin.views ?? {})) as Record<string, View>
	);
	const camera = $derived(editor.camera.get());
	// Only what is on screen (and a little around it) is drawn.
	const shown = $derived(visibleShapeIds(editor));

	let surface: HTMLElement | null = null;
	/** The pointer that is down. A second finger or pen while one is down is ignored. */
	let activePointer: number | null = null;
	// Two fingers on a touch screen move and zoom the view, whatever the tool.
	const pinch = createPinch(() => editor);

	/** Where an event is, in pixels from the surface's top left. */
	function local(event: MouseEvent) {
		const rect = surface!.getBoundingClientRect();
		return { x: event.clientX - rect.left, y: event.clientY - rect.top };
	}

	function onpointerdown(event: PointerEvent) {
		if (inTextField(event)) return;
		if (event.pointerType === 'touch' && pinch.down(event.pointerId, local(event))) {
			// The first finger had begun something (a stroke, a drag): that is dropped.
			if (activePointer !== null) editor.dispatch({ type: 'cancel' });
			activePointer = null;
			return;
		}
		if (activePointer !== null || pinch.active) return;
		activePointer = event.pointerId;
		surface!.focus({ preventScroll: true });
		surface!.setPointerCapture(event.pointerId);
		if (event.button === 1) event.preventDefault();
		editor.dispatch(pointerInfo(event, 'down', local(event)));
	}

	function onpointermove(event: PointerEvent) {
		if (pinch.move(event.pointerId, local(event))) return;
		if (activePointer !== null && event.pointerId !== activePointer) return;
		// A pen or a fast mouse reports several positions per frame: a stroke wants them all.
		const events = editor.tool === 'draw' ? (event.getCoalescedEvents?.() ?? []) : [];
		if (events.length > 1)
			for (const each of events) editor.dispatch(pointerInfo(each, 'move', local(each)));
		else editor.dispatch(pointerInfo(event, 'move', local(event)));
	}

	function onpointerup(event: PointerEvent) {
		pinch.up(event.pointerId);
		if (event.pointerId !== activePointer) return;
		activePointer = null;
		editor.dispatch(pointerInfo(event, 'up', local(event)));
	}

	function onpointercancel(event: PointerEvent) {
		pinch.up(event.pointerId);
		if (event.pointerId !== activePointer) return;
		activePointer = null;
		editor.dispatch({ type: 'cancel' });
	}

	function ondblclick(event: MouseEvent) {
		if (inTextField(event) || event.button !== 0) return;
		editor.dispatch(doubleClickInfo(event, local(event)));
	}

	function oncontextmenu(event: MouseEvent) {
		// In a shape's text field, no menu of ours.
		if (inTextField(event)) return event.preventDefault();
		selectForMenu(editor, editor.screenToPage(local(event)));
	}

	// The surface's own handlers, and a wrapper's of the same name after them.
	const own = {
		onpointerdown,
		onpointermove,
		onpointerup,
		onpointercancel,
		ondblclick,
		oncontextmenu
	};
	function merged(given: SurfaceProps = {}): SurfaceProps {
		const props = { ...given };
		for (const [name, handler] of Object.entries(own) as [string, (event: never) => void][]) {
			const theirs = given[name];
			props[name] =
				typeof theirs === 'function'
					? (event: Event) => {
							handler(event as never);
							if (!event.defaultPrevented) theirs(event);
						}
					: handler;
		}
		return props;
	}

	function onkey(event: KeyboardEvent, name: 'down' | 'up') {
		const info = keyInfo(event, name, surface);
		if (info) editor.dispatch(info);
	}

	// When an edit ends, the focus goes back to the surface, so the canvas's keys keep working.
	// Unless it has already gone to a control (a click on the toolbar ended the edit).
	let wasEditing = false;
	const refocus: Attachment<HTMLElement> = (element) => {
		const editing = editor.editing.get() !== null;
		if (wasEditing && !editing) {
			const focused = document.activeElement;
			if (!focused || focused === document.body || focused.closest('.kd-world'))
				element.focus({ preventScroll: true });
		}
		wasEditing = editing;
	};

	// The wheel moves the view, and the view follows the surface's size.
	const wheelAndSize: Attachment<HTMLElement> = (element) => {
		// Not passive: the wheel must not scroll or zoom the page around the canvas.
		const onwheel = (event: WheelEvent) => {
			event.preventDefault();
			editor.dispatch(wheelInfo(event, local(event)));
		};
		element.addEventListener('wheel', onwheel, { passive: false });
		// The size is known at once, not only when the observer first reports.
		editor.viewport.set({ w: element.clientWidth, h: element.clientHeight });
		const observer = new ResizeObserver(([entry]) =>
			editor.viewport.set({ w: entry.contentRect.width, h: entry.contentRect.height })
		);
		observer.observe(element);
		return () => {
			element.removeEventListener('wheel', onwheel);
			observer.disconnect();
		};
	};
</script>

{#snippet canvas(given?: SurfaceProps)}
	<!-- The surface is one widget (role=application) that takes the pointer and the keys itself. -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<div
		{...merged(given)}
		bind:this={surface}
		{@attach refocus}
		{@attach wheelAndSize}
		class="kd-surface"
		role="application"
		aria-label={label}
		tabindex="0"
		style:cursor={editor.cursor.get()}
		style:--kd-grid-size="{24 * camera.z}px"
		style:--kd-grid-x="{camera.x}px"
		style:--kd-grid-y="{camera.y}px"
		data-grid={editor.grid.get().show && camera.z >= 0.5 ? 'on' : 'off'}
	>
		<div class="kd-world" style:transform="translate({camera.x}px, {camera.y}px) scale({camera.z})">
			{#each shown as id (id)}
				<ShapeView {id} {editor} {views} />
			{/each}
		</div>
		<Overlay {editor} />
	</div>
{/snippet}

<!-- Key and clipboard events bubble up here from the surface and from the controls above it. -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="kd-root"
	onkeydown={(event) => onkey(event, 'down')}
	onkeyup={(event) => onkey(event, 'up')}
	oncopy={(event) => copyShapes(editor, event)}
	oncut={(event) => copyShapes(editor, event, true)}
	onpaste={(event) => pasteInto(editor, event)}
	ondragover={(event) => event.preventDefault()}
	ondrop={(event) => dropFiles(editor, event, local(event))}
>
	{#if around}{@render around(canvas)}{:else}{@render canvas()}{/if}
	{@render children?.()}
</div>
