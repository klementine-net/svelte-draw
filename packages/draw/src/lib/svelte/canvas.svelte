<script lang="ts">
	import type { Snippet } from 'svelte';
	import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from '@klementine/ui/context-menu';
	import './reactive.ts';
	import {
		box,
		type AssetRecord,
		type DrawEvent,
		type Editor,
		type PointerInfo,
		type ShapeRecord,
		type Vec
	} from '../index.ts';
	import type { DrawSveltePlugin, ShapeView as View } from './plugin.ts';
	import { defaultLabels, type DrawLabels } from './labels.ts';
	import ShapeView from './shape-view.svelte';
	import Overlay from './overlay.svelte';
	import CanvasMenu from './canvas-menu.svelte';

	/**
	 * Canvas: the surface an editor is shown and worked on. It draws the editor's shapes through
	 * the plugins' views, and turns pointer, wheel and key events into the editor's events;
	 * every decision about what an event means is the editor's and its tools'.
	 *
	 * `children` sit above the surface (a toolbar, a panel) and do not send it events. Name the
	 * canvas with `label`. Fills its parent: give the parent a size.
	 *
	 * Also the canvas's: copy, cut and paste through the system clipboard, two-finger pinch and
	 * pan on a touch screen, and the right-click menu (`labels` translates it).
	 *
	 * @example
	 * <Canvas {editor} plugins={defaultPlugins} label="Whiteboard">
	 *   <DrawToolbar {editor} plugins={defaultPlugins} />
	 * </Canvas>
	 */
	let {
		editor,
		plugins,
		label,
		labels = defaultLabels,
		children
	}: {
		editor: Editor;
		plugins: DrawSveltePlugin[];
		label: string;
		labels?: DrawLabels;
		children?: Snippet;
	} = $props();

	const views = $derived(
		Object.assign({}, ...plugins.map((plugin) => plugin.views ?? {})) as Record<string, View>
	);
	const camera = $derived(editor.camera.get());
	// Only what is on screen (and a little around it) is drawn: a large board stays light.
	const shown = $derived.by(() => {
		const ids = editor.getShapeIds();
		const view = editor.getViewportPageBounds();
		// (Not before the canvas knows its own size: then everything would count as off screen.)
		if (!editor.culling.get() || view.w === 0 || view.h === 0) return ids;
		const margin = 200 / camera.z;
		const area = {
			x: view.x - margin,
			y: view.y - margin,
			w: view.w + margin * 2,
			h: view.h + margin * 2
		};
		const kept = new Set([...editor.selection.get(), editor.editing.get()]);
		return ids.filter((id) => {
			if (kept.has(id)) return true;
			const shape = editor.getShape(id);
			return !!shape && box.intersects(area, editor.getShapePageBounds(shape));
		});
	});

	let surface = $state<HTMLElement | null>(null);
	/** The pointer that is down. A second finger or pen while one is down is ignored. */
	let activePointer: number | null = null;

	const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
	const modifiers = (event: MouseEvent | KeyboardEvent) => ({
		shift: event.shiftKey,
		alt: event.altKey,
		meta: isMac ? event.metaKey : event.ctrlKey
	});

	function local(event: MouseEvent) {
		const rect = surface!.getBoundingClientRect();
		return { x: event.clientX - rect.left, y: event.clientY - rect.top };
	}

	function pointer(event: PointerEvent, name: PointerInfo['name']): PointerInfo {
		const isPen = event.pointerType === 'pen';
		return {
			type: 'pointer',
			name,
			point: local(event),
			button: event.button,
			pressure: isPen && event.pressure > 0 ? event.pressure : 0.5,
			isPen,
			...modifiers(event)
		};
	}

	/** Whether the event is inside a shape's text field: then it is the field's, not the canvas's. */
	const inTextField = (event: Event) => (event.target as HTMLElement).isContentEditable;

	// Two fingers on a touch screen move and zoom the view, whatever the tool.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity -- read in handlers only, never drawn
	const fingers = new Map<number, Vec>();
	let pinch: { distance: number; middle: Vec } | null = null;
	const pinchNow = () => {
		const [a, b] = [...fingers.values()];
		return {
			distance: Math.hypot(a.x - b.x, a.y - b.y),
			middle: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
		};
	};

	function onpointerdown(event: PointerEvent) {
		if (inTextField(event)) return;
		if (event.pointerType === 'touch') {
			fingers.set(event.pointerId, local(event));
			if (fingers.size === 2) {
				// The first finger had begun something (a stroke, a drag): that is dropped.
				if (activePointer !== null) editor.dispatch({ type: 'cancel' });
				activePointer = null;
				pinch = pinchNow();
				return;
			}
		}
		if (activePointer !== null || pinch) return;
		activePointer = event.pointerId;
		surface!.focus({ preventScroll: true });
		surface!.setPointerCapture(event.pointerId);
		if (event.button === 1) event.preventDefault();
		editor.dispatch(pointer(event, 'down'));
	}

	function onpointermove(event: PointerEvent) {
		if (fingers.has(event.pointerId)) fingers.set(event.pointerId, local(event));
		if (pinch) {
			if (fingers.size < 2) return;
			const now = pinchNow();
			editor.pan(now.middle.x - pinch.middle.x, now.middle.y - pinch.middle.y);
			if (pinch.distance > 0)
				editor.zoomTo(editor.camera.peek().z * (now.distance / pinch.distance), now.middle);
			pinch = now;
			return;
		}
		if (activePointer !== null && event.pointerId !== activePointer) return;
		// A pen or a fast mouse reports several positions per frame: a stroke wants them all.
		const events = editor.tool === 'draw' ? (event.getCoalescedEvents?.() ?? []) : [];
		if (events.length > 1) for (const each of events) editor.dispatch(pointer(each, 'move'));
		else editor.dispatch(pointer(event, 'move'));
	}

	function onpointerup(event: PointerEvent) {
		fingers.delete(event.pointerId);
		// A pinch is over once both fingers are up; the one still down does nothing meanwhile.
		if (pinch && fingers.size === 0) pinch = null;
		if (event.pointerId !== activePointer) return;
		activePointer = null;
		editor.dispatch(pointer(event, 'up'));
	}

	function onpointercancel(event: PointerEvent) {
		fingers.delete(event.pointerId);
		if (pinch && fingers.size === 0) pinch = null;
		if (event.pointerId !== activePointer) return;
		activePointer = null;
		editor.dispatch({ type: 'cancel' });
	}

	function ondblclick(event: MouseEvent) {
		if (inTextField(event) || event.button !== 0) return;
		editor.dispatch({
			type: 'double_click',
			name: 'down',
			point: local(event),
			button: 0,
			pressure: 0.5,
			isPen: false,
			...modifiers(event)
		});
	}

	/** A right-click picks what is under it first (also a locked shape, so it can be unlocked). */
	function oncontextmenu(event: MouseEvent) {
		// In a shape's text field, no menu of ours.
		if (inTextField(event)) return event.preventDefault();
		const page = editor.screenToPage(local(event));
		const leaf = editor.getShapeAtPoint(page, { locked: true });
		const hit = leaf && editor.getSelectable(leaf);
		const bounds = editor.getSelectionBounds();
		const inSelection =
			bounds &&
			page.x >= bounds.x &&
			page.x <= bounds.x + bounds.w &&
			page.y >= bounds.y &&
			page.y <= bounds.y + bounds.h;
		if (hit && !editor.selection.peek().includes(hit.id)) editor.select([hit.id]);
		else if (!hit && !inSelection) editor.select([]);
	}

	// ── The clipboard ───────────────────────────────────────────────────────────────────────
	// Shapes travel as JSON under a type of their own, so they paste into another canvas (another
	// tab, another app built on Draw) and never into a text field as a wall of JSON.
	const CLIPBOARD_TYPE = 'application/x-klementine-draw';
	const inField = (event: Event) => {
		const target = event.target as HTMLElement;
		return target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
	};

	function oncopy(event: ClipboardEvent, cut = false) {
		if (inField(event) || !event.clipboardData) return;
		const content = cut ? editor.cut() : editor.copy();
		if (content.length === 0) return;
		// With the files the shapes show, so a picture arrives whole in another tab.
		const assets = editor.getContentAssets(content);
		event.clipboardData.setData(CLIPBOARD_TYPE, JSON.stringify({ shapes: content, assets }));
		// What the shapes say, for a paste into a text field.
		const text = content
			.map((shape) => shape.props.text)
			.filter((value) => typeof value === 'string' && value !== '')
			.join('\n');
		event.clipboardData.setData('text/plain', text);
		event.preventDefault();
	}

	function onpaste(event: ClipboardEvent) {
		if (inField(event) || !event.clipboardData) return;
		event.preventDefault();
		const { w, h } = editor.viewport.peek();
		const { screen } = editor.inputs;
		// At the pointer when it is over the canvas, in the middle of the view otherwise.
		const over = screen.x >= 0 && screen.y >= 0 && screen.x <= w && screen.y <= h;
		const at = over ? editor.inputs.page : editor.screenToPage({ x: w / 2, y: h / 2 });
		const data = event.clipboardData.getData(CLIPBOARD_TYPE);
		if (data) {
			try {
				const { shapes, assets } = JSON.parse(data) as {
					shapes?: ShapeRecord[];
					assets?: AssetRecord[];
				};
				if (Array.isArray(shapes)) return editor.paste(shapes, at, assets);
			} catch {
				// Not ours after all: fall through to plain text.
			}
		}
		// A copied picture (a screenshot, an image from another app).
		const files = [...event.clipboardData.files];
		if (files.length > 0) return void editor.addFiles(files, at);
		const text = event.clipboardData.getData('text/plain').trim();
		if (text) editor.pasteText(text, at);
	}

	/** Files dropped on the canvas land where they were dropped. */
	function ondrop(event: DragEvent) {
		const files = [...(event.dataTransfer?.files ?? [])];
		if (files.length === 0) return;
		event.preventDefault();
		void editor.addFiles(files, editor.screenToPage(local(event)));
	}

	function onkey(event: KeyboardEvent, name: 'down' | 'up') {
		// Keys reach the canvas from anywhere inside it (a tool's key still works after a click on
		// the toolbar), except where the focused control needs them itself: typing in a field, or
		// moving and pressing within a bar.
		const target = event.target as HTMLElement;
		if (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
		// A shape's text field keeps its keys too; only Escape (not one that ends an IME
		// composition) goes on to the editor, which ends the edit.
		if (target.isContentEditable && (event.key !== 'Escape' || event.isComposing)) return;
		if (target !== surface && /^(Arrow|Home|End|Enter| |Tab)/.test(event.key)) return;
		const info: DrawEvent = {
			type: 'key',
			name,
			key: event.key,
			repeat: event.repeat,
			...modifiers(event)
		};
		// Keep the keys the canvas uses from scrolling the page or reaching the browser.
		if (
			name === 'down' &&
			(info.meta ? 'zyadg'.includes(event.key.toLowerCase()) : event.key.startsWith('Arrow'))
		)
			event.preventDefault();
		editor.dispatch(info);
	}

	// When an edit ends, the focus goes back to the surface, so the canvas's keys keep working.
	// Unless it has already gone to a control (a click on the toolbar ended the edit).
	let wasEditing = false;
	$effect(() => {
		const editing = editor.editing.get() !== null;
		if (wasEditing && !editing) {
			const focused = document.activeElement;
			if (!focused || focused === document.body || focused.closest('.kd-world'))
				surface?.focus({ preventScroll: true });
		}
		wasEditing = editing;
	});

	$effect(() => {
		// Not passive: the wheel must not scroll or zoom the page around the canvas.
		const onwheel = (event: WheelEvent) => {
			event.preventDefault();
			const unit = event.deltaMode === 1 ? 16 : 1;
			editor.dispatch({
				type: 'wheel',
				point: local(event),
				delta: { x: event.deltaX * unit, y: event.deltaY * unit },
				shift: event.shiftKey,
				alt: event.altKey,
				// A pinch on a trackpad arrives as a wheel with Ctrl held.
				meta: event.ctrlKey || event.metaKey
			});
		};
		const element = surface;
		if (!element) return;
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
	});
</script>

<!-- Key and clipboard events bubble up here from the surface and from the controls above it. -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="kd-root"
	onkeydown={(event) => onkey(event, 'down')}
	onkeyup={(event) => onkey(event, 'up')}
	oncopy={(event) => oncopy(event)}
	oncut={(event) => oncopy(event, true)}
	{onpaste}
	ondragover={(event) => event.preventDefault()}
	{ondrop}
>
	<ContextMenu>
		<!-- The surface is one widget (role=application) that takes the pointer and the keys itself. -->
		<ContextMenuTrigger
			bind:ref={surface}
			{onpointerdown}
			{onpointermove}
			{onpointerup}
			{onpointercancel}
			{ondblclick}
			{oncontextmenu}
		>
			{#snippet child({ props })}
				<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
				<div
					{...props}
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
					<div
						class="kd-world"
						style:transform="translate({camera.x}px, {camera.y}px) scale({camera.z})"
					>
						{#each shown as id (id)}
							<ShapeView {id} {editor} {views} />
						{/each}
					</div>
					<Overlay {editor} />
				</div>
			{/snippet}
		</ContextMenuTrigger>
		<ContextMenuContent><CanvasMenu {editor} {labels} canvas={surface} /></ContextMenuContent>
	</ContextMenu>
	{@render children?.()}
</div>
