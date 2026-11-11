<script lang="ts">
	import type { Snippet } from 'svelte';
	import './reactive.ts';
	import type { DrawEvent, Editor, PointerInfo } from '../index.ts';
	import type { DrawSveltePlugin, ShapeView as View } from './plugin.ts';
	import ShapeView from './shape-view.svelte';
	import Overlay from './overlay.svelte';

	/**
	 * Canvas: the surface an editor is shown and worked on. It draws the editor's shapes through
	 * the plugins' views, and turns pointer, wheel and key events into the editor's events;
	 * every decision about what an event means is the editor's and its tools'.
	 *
	 * `children` sit above the surface (a toolbar, a panel) and do not send it events. Name the
	 * canvas with `label`. Fills its parent: give the parent a size.
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
		children
	}: { editor: Editor; plugins: DrawSveltePlugin[]; label: string; children?: Snippet } = $props();

	const views = $derived(
		Object.assign({}, ...plugins.map((plugin) => plugin.views ?? {})) as Record<string, View>
	);
	const camera = $derived(editor.camera.get());

	let surface: HTMLDivElement;
	/** The pointer that is down. A second finger or pen while one is down is ignored. */
	let activePointer: number | null = null;

	const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
	const modifiers = (event: MouseEvent | KeyboardEvent) => ({
		shift: event.shiftKey,
		alt: event.altKey,
		meta: isMac ? event.metaKey : event.ctrlKey
	});

	function local(event: MouseEvent) {
		const rect = surface.getBoundingClientRect();
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

	function onpointerdown(event: PointerEvent) {
		if (activePointer !== null) return;
		activePointer = event.pointerId;
		surface.focus({ preventScroll: true });
		surface.setPointerCapture(event.pointerId);
		if (event.button === 1) event.preventDefault();
		editor.dispatch(pointer(event, 'down'));
	}

	function onpointermove(event: PointerEvent) {
		if (activePointer !== null && event.pointerId !== activePointer) return;
		// A pen or a fast mouse reports several positions per frame: a stroke wants them all.
		const events = editor.tool === 'draw' ? (event.getCoalescedEvents?.() ?? []) : [];
		if (events.length > 1) for (const each of events) editor.dispatch(pointer(each, 'move'));
		else editor.dispatch(pointer(event, 'move'));
	}

	function onpointerup(event: PointerEvent) {
		if (event.pointerId !== activePointer) return;
		activePointer = null;
		editor.dispatch(pointer(event, 'up'));
	}

	function onkey(event: KeyboardEvent, name: 'down' | 'up') {
		// Keys reach the canvas from anywhere inside it (a tool's key still works after a click on
		// the toolbar), except where the focused control needs them itself: typing in a field, or
		// moving and pressing within a bar.
		const target = event.target as HTMLElement;
		if (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
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
			(info.meta ? 'zyad'.includes(event.key.toLowerCase()) : event.key.startsWith('Arrow'))
		)
			event.preventDefault();
		editor.dispatch(info);
	}

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
		surface.addEventListener('wheel', onwheel, { passive: false });
		const observer = new ResizeObserver(([entry]) =>
			editor.viewport.set({ w: entry.contentRect.width, h: entry.contentRect.height })
		);
		observer.observe(surface);
		return () => {
			surface.removeEventListener('wheel', onwheel);
			observer.disconnect();
		};
	});
</script>

<!-- Key events bubble up here from the surface and from the controls above it. -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="kd-root"
	onkeydown={(event) => onkey(event, 'down')}
	onkeyup={(event) => onkey(event, 'up')}
>
	<!-- The surface is one widget (role=application) that takes the pointer and the keys itself. -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<div
		bind:this={surface}
		class="kd-surface"
		role="application"
		aria-label={label}
		tabindex="0"
		style:cursor={editor.cursor.get()}
		style:--kd-grid-size="{24 * camera.z}px"
		style:--kd-grid-x="{camera.x}px"
		style:--kd-grid-y="{camera.y}px"
		data-grid={camera.z >= 0.5 ? 'on' : 'off'}
		{onpointerdown}
		{onpointermove}
		{onpointerup}
		onpointercancel={(event) => {
			if (event.pointerId !== activePointer) return;
			activePointer = null;
			editor.dispatch({ type: 'cancel' });
		}}
		oncontextmenu={(event) => event.preventDefault()}
	>
		<div class="kd-world" style:transform="translate({camera.x}px, {camera.y}px) scale({camera.z})">
			{#each editor.getShapeIds() as id (id)}
				<ShapeView {id} {editor} {views} />
			{/each}
		</div>
		<Overlay {editor} />
	</div>
	{@render children?.()}
</div>
