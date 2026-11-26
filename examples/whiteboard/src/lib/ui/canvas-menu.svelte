<script lang="ts">
	import {
		ContextMenuCheckboxItem,
		ContextMenuItem,
		ContextMenuSeparator,
		ContextMenuShortcut,
		ContextMenuSub,
		ContextMenuSubContent,
		ContextMenuSubTrigger
	} from '@klementine/ui/context-menu';
	import { Kbd } from '@klementine/ui/kbd';
	import type { Editor } from '@simon-lund/svelte-draw';
	import { toPng } from '@simon-lund/svelte-draw/svelte';
	import { defaultLabels, type DrawLabels } from './labels.ts';

	/**
	 * CanvasMenu: what the canvas's right-click menu offers for the selection: clipboard,
	 * order, alignment, flipping, grouping, locking, deleting. Only what applies shows. It is
	 * the inside of a ContextMenuContent; `Canvas` puts it there.
	 *
	 * @example
	 * <ContextMenuContent><CanvasMenu {editor} /></ContextMenuContent>
	 */
	let {
		editor,
		labels = defaultLabels,
		canvas
	}: {
		editor: Editor;
		labels?: DrawLabels;
		/** The canvas's element: with it, the menu offers a copy of the selection as a picture. */
		canvas?: Element | null;
	} = $props();

	async function copyPicture() {
		if (!canvas) return;
		const png = await toPng(editor, canvas, { ids: editor.selection.peek() });
		if (png) await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
	}

	const words = $derived(labels.menu);
	const selected = $derived(editor.getSelectedShapes());
	const movable = $derived(editor.getSelectionRoots());
	const locked = $derived(selected.length > 0 && selected.every((shape) => shape.locked));
	const groups = $derived(selected.some((shape) => editor.util(shape.kind).group));
	const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
	const mod = isMac ? '⌘' : 'Ctrl';
	// The switches the first selected shape's kind offers (a line's arrowheads).
	const toggles = $derived(
		selected[0] && !locked ? editor.util(selected[0].kind).toggles(selected[0]) : []
	);
	const grid = $derived(editor.grid.get());
	// Where the menu was opened: a paste lands there.
	const at = $derived(editor.inputs.page);
</script>

{#if editor.readOnly.get()}
	<ContextMenuItem onSelect={() => editor.zoomToFit()}>{labels.zoomFit}</ContextMenuItem>
{:else}
	{#if movable.length > 0}
		<ContextMenuItem onSelect={() => editor.cut()}>
			{words.cut}<ContextMenuShortcut><Kbd>{mod} X</Kbd></ContextMenuShortcut>
		</ContextMenuItem>
		<ContextMenuItem onSelect={() => editor.copy()}>
			{words.copy}<ContextMenuShortcut><Kbd>{mod} C</Kbd></ContextMenuShortcut>
		</ContextMenuItem>
	{/if}
	<ContextMenuItem
		disabled={editor.clipboard.length === 0}
		onSelect={() => editor.paste(undefined, at)}
	>
		{words.paste}<ContextMenuShortcut><Kbd>{mod} V</Kbd></ContextMenuShortcut>
	</ContextMenuItem>
	{#if movable.length > 0}
		<ContextMenuItem onSelect={() => editor.duplicateSelection()}>
			{words.duplicate}<ContextMenuShortcut><Kbd>{mod} D</Kbd></ContextMenuShortcut>
		</ContextMenuItem>
		{#if canvas}
			<ContextMenuItem onSelect={copyPicture}>{words.copyPicture}</ContextMenuItem>
		{/if}
		<ContextMenuSeparator />
		<ContextMenuSub>
			<ContextMenuSubTrigger>{words.order}</ContextMenuSubTrigger>
			<ContextMenuSubContent>
				<ContextMenuItem onSelect={() => editor.bringToFront()}>
					{words.toFront}<ContextMenuShortcut><Kbd>]</Kbd></ContextMenuShortcut>
				</ContextMenuItem>
				<ContextMenuItem onSelect={() => editor.bringForward()}>{words.forward}</ContextMenuItem>
				<ContextMenuItem onSelect={() => editor.sendBackward()}>{words.backward}</ContextMenuItem>
				<ContextMenuItem onSelect={() => editor.sendToBack()}>
					{words.toBack}<ContextMenuShortcut><Kbd>[</Kbd></ContextMenuShortcut>
				</ContextMenuItem>
			</ContextMenuSubContent>
		</ContextMenuSub>
		{#if movable.length > 1}
			<ContextMenuSub>
				<ContextMenuSubTrigger>{words.align}</ContextMenuSubTrigger>
				<ContextMenuSubContent>
					<ContextMenuItem onSelect={() => editor.alignSelection('left')}>
						{words.alignLeft}
					</ContextMenuItem>
					<ContextMenuItem onSelect={() => editor.alignSelection('center')}>
						{words.alignCenter}
					</ContextMenuItem>
					<ContextMenuItem onSelect={() => editor.alignSelection('right')}>
						{words.alignRight}
					</ContextMenuItem>
					<ContextMenuSeparator />
					<ContextMenuItem onSelect={() => editor.alignSelection('top')}>
						{words.alignTop}
					</ContextMenuItem>
					<ContextMenuItem onSelect={() => editor.alignSelection('middle')}>
						{words.alignMiddle}
					</ContextMenuItem>
					<ContextMenuItem onSelect={() => editor.alignSelection('bottom')}>
						{words.alignBottom}
					</ContextMenuItem>
					{#if movable.length > 2}
						<ContextMenuSeparator />
						<ContextMenuItem onSelect={() => editor.distributeSelection('x')}>
							{words.distributeX}
						</ContextMenuItem>
						<ContextMenuItem onSelect={() => editor.distributeSelection('y')}>
							{words.distributeY}
						</ContextMenuItem>
					{/if}
				</ContextMenuSubContent>
			</ContextMenuSub>
		{/if}
		<ContextMenuSub>
			<ContextMenuSubTrigger>{words.flip}</ContextMenuSubTrigger>
			<ContextMenuSubContent>
				<ContextMenuItem onSelect={() => editor.flipSelection('x')}>{words.flipX}</ContextMenuItem>
				<ContextMenuItem onSelect={() => editor.flipSelection('y')}>{words.flipY}</ContextMenuItem>
			</ContextMenuSubContent>
		</ContextMenuSub>
		{#if editor.canGroupSelection()}
			<ContextMenuItem onSelect={() => editor.groupSelection()}>
				{words.group}<ContextMenuShortcut><Kbd>{mod} G</Kbd></ContextMenuShortcut>
			</ContextMenuItem>
		{/if}
	{/if}
	{#each toggles as toggle (toggle.id)}
		<ContextMenuCheckboxItem
			checked={toggle.on}
			onCheckedChange={() => editor.toggleSelection(toggle.id)}
		>
			{labels.toggles[toggle.id] ?? toggle.id}
		</ContextMenuCheckboxItem>
	{/each}
	{#if groups}
		<ContextMenuItem onSelect={() => editor.ungroupSelection()}>
			{words.ungroup}<ContextMenuShortcut><Kbd>{mod} ⇧ G</Kbd></ContextMenuShortcut>
		</ContextMenuItem>
	{/if}
	{#if selected.length > 0}
		<ContextMenuItem onSelect={() => editor.toggleLock()}>
			{locked ? words.unlock : words.lock}
		</ContextMenuItem>
		<ContextMenuItem onSelect={() => editor.zoomToSelection()}>
			{words.zoomToSelection}
		</ContextMenuItem>
	{:else}
		<ContextMenuItem onSelect={() => editor.selectAll()}>
			{words.selectAll}<ContextMenuShortcut><Kbd>{mod} A</Kbd></ContextMenuShortcut>
		</ContextMenuItem>
		<ContextMenuItem onSelect={() => editor.zoomToFit()}>{labels.zoomFit}</ContextMenuItem>
		<ContextMenuSeparator />
		<ContextMenuCheckboxItem
			checked={grid.show}
			onCheckedChange={() => editor.grid.set({ ...grid, show: !grid.show })}
		>
			{words.showGrid}
		</ContextMenuCheckboxItem>
		<ContextMenuCheckboxItem
			checked={grid.snap}
			onCheckedChange={() => editor.grid.set({ ...grid, snap: !grid.snap })}
		>
			{words.snapGrid}
		</ContextMenuCheckboxItem>
	{/if}
	{#if movable.length > 0}
		<ContextMenuSeparator />
		<ContextMenuItem onSelect={() => editor.deleteSelection()}>
			{words.delete}<ContextMenuShortcut><Kbd>Del</Kbd></ContextMenuShortcut>
		</ContextMenuItem>
	{/if}
{/if}
