<script lang="ts">
	import CaretRight from 'phosphor-svelte/lib/CaretRight';
	import Check from 'phosphor-svelte/lib/Check';
	import { ContextMenu } from 'bits-ui';
	import { toPng, type Editor } from '@klementine/svelte-draw';
	import { defaultLabels, type DrawLabels } from './labels';
	import { useScheme } from './board';

	/**
	 * CanvasMenu: what the canvas's right-click menu offers for the selection: clipboard,
	 * order, alignment, flipping, grouping, locking, deleting. Only what applies shows. It is
	 * the inside of a context menu's content; `Whiteboard` puts it there.
	 *
	 * @example
	 * <ContextMenu.Content class="wb wb-menu"><CanvasMenu {editor} /></ContextMenu.Content>
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
	const scheme = useScheme();
	// Where the menu was opened: a paste lands there.
	const at = $derived(editor.inputs.page);
</script>

{#if editor.readOnly.get()}
	<ContextMenu.Item class="wb-menu-item" onSelect={() => editor.zoomToFit()}
		>{labels.zoomFit}</ContextMenu.Item
	>
{:else}
	{#if movable.length > 0}
		<ContextMenu.Item class="wb-menu-item" onSelect={() => editor.cut()}>
			{words.cut}<span class="wb-keys" aria-hidden="true"><kbd class="wb-key">{mod} X</kbd></span>
		</ContextMenu.Item>
		<ContextMenu.Item class="wb-menu-item" onSelect={() => editor.copy()}>
			{words.copy}<span class="wb-keys" aria-hidden="true"><kbd class="wb-key">{mod} C</kbd></span>
		</ContextMenu.Item>
	{/if}
	<ContextMenu.Item
		class="wb-menu-item"
		disabled={editor.clipboard.length === 0}
		onSelect={() => editor.paste(undefined, at)}
	>
		{words.paste}<span class="wb-keys" aria-hidden="true"><kbd class="wb-key">{mod} V</kbd></span>
	</ContextMenu.Item>
	{#if movable.length > 0}
		<ContextMenu.Item class="wb-menu-item" onSelect={() => editor.duplicateSelection()}>
			{words.duplicate}<span class="wb-keys" aria-hidden="true"
				><kbd class="wb-key">{mod} D</kbd></span
			>
		</ContextMenu.Item>
		{#if canvas}
			<ContextMenu.Item class="wb-menu-item" onSelect={copyPicture}
				>{words.copyPicture}</ContextMenu.Item
			>
		{/if}
		<ContextMenu.Separator class="wb-menu-rule" />
		<ContextMenu.Sub>
			<ContextMenu.SubTrigger class="wb-menu-item">
				{words.order}<CaretRight class="wb-more" aria-hidden="true" />
			</ContextMenu.SubTrigger>
			<ContextMenu.Portal>
				<ContextMenu.SubContent
					align="start"
					alignOffset={-6}
					sideOffset={10}
					collisionPadding={8}
					class="wb wb-menu"
					data-scheme={scheme()}
				>
					<ContextMenu.Item class="wb-menu-item" onSelect={() => editor.bringToFront()}>
						{words.toFront}<span class="wb-keys" aria-hidden="true"
							><kbd class="wb-key">]</kbd></span
						>
					</ContextMenu.Item>
					<ContextMenu.Item class="wb-menu-item" onSelect={() => editor.bringForward()}
						>{words.forward}</ContextMenu.Item
					>
					<ContextMenu.Item class="wb-menu-item" onSelect={() => editor.sendBackward()}
						>{words.backward}</ContextMenu.Item
					>
					<ContextMenu.Item class="wb-menu-item" onSelect={() => editor.sendToBack()}>
						{words.toBack}<span class="wb-keys" aria-hidden="true"><kbd class="wb-key">[</kbd></span
						>
					</ContextMenu.Item>
				</ContextMenu.SubContent>
			</ContextMenu.Portal>
		</ContextMenu.Sub>
		{#if movable.length > 1}
			<ContextMenu.Sub>
				<ContextMenu.SubTrigger class="wb-menu-item">
					{words.align}<CaretRight class="wb-more" aria-hidden="true" />
				</ContextMenu.SubTrigger>
				<ContextMenu.Portal>
					<ContextMenu.SubContent
						align="start"
						alignOffset={-6}
						sideOffset={10}
						collisionPadding={8}
						class="wb wb-menu"
						data-scheme={scheme()}
					>
						<ContextMenu.Item class="wb-menu-item" onSelect={() => editor.alignSelection('left')}>
							{words.alignLeft}
						</ContextMenu.Item>
						<ContextMenu.Item class="wb-menu-item" onSelect={() => editor.alignSelection('center')}>
							{words.alignCenter}
						</ContextMenu.Item>
						<ContextMenu.Item class="wb-menu-item" onSelect={() => editor.alignSelection('right')}>
							{words.alignRight}
						</ContextMenu.Item>
						<ContextMenu.Separator class="wb-menu-rule" />
						<ContextMenu.Item class="wb-menu-item" onSelect={() => editor.alignSelection('top')}>
							{words.alignTop}
						</ContextMenu.Item>
						<ContextMenu.Item class="wb-menu-item" onSelect={() => editor.alignSelection('middle')}>
							{words.alignMiddle}
						</ContextMenu.Item>
						<ContextMenu.Item class="wb-menu-item" onSelect={() => editor.alignSelection('bottom')}>
							{words.alignBottom}
						</ContextMenu.Item>
						{#if movable.length > 2}
							<ContextMenu.Separator class="wb-menu-rule" />
							<ContextMenu.Item
								class="wb-menu-item"
								onSelect={() => editor.distributeSelection('x')}
							>
								{words.distributeX}
							</ContextMenu.Item>
							<ContextMenu.Item
								class="wb-menu-item"
								onSelect={() => editor.distributeSelection('y')}
							>
								{words.distributeY}
							</ContextMenu.Item>
						{/if}
					</ContextMenu.SubContent>
				</ContextMenu.Portal>
			</ContextMenu.Sub>
		{/if}
		<ContextMenu.Sub>
			<ContextMenu.SubTrigger class="wb-menu-item">
				{words.flip}<CaretRight class="wb-more" aria-hidden="true" />
			</ContextMenu.SubTrigger>
			<ContextMenu.Portal>
				<ContextMenu.SubContent
					align="start"
					alignOffset={-6}
					sideOffset={10}
					collisionPadding={8}
					class="wb wb-menu"
					data-scheme={scheme()}
				>
					<ContextMenu.Item class="wb-menu-item" onSelect={() => editor.flipSelection('x')}
						>{words.flipX}</ContextMenu.Item
					>
					<ContextMenu.Item class="wb-menu-item" onSelect={() => editor.flipSelection('y')}
						>{words.flipY}</ContextMenu.Item
					>
				</ContextMenu.SubContent>
			</ContextMenu.Portal>
		</ContextMenu.Sub>
		{#if editor.canGroupSelection()}
			<ContextMenu.Item class="wb-menu-item" onSelect={() => editor.groupSelection()}>
				{words.group}<span class="wb-keys" aria-hidden="true"
					><kbd class="wb-key">{mod} G</kbd></span
				>
			</ContextMenu.Item>
		{/if}
	{/if}
	{#each toggles as toggle (toggle.id)}
		<ContextMenu.CheckboxItem
			class="wb-menu-item wb-marked"
			checked={toggle.on}
			onCheckedChange={() => editor.toggleSelection(toggle.id)}
		>
			{#snippet children({ checked })}
				<span class="wb-mark" aria-hidden="true"
					>{#if checked}<Check />{/if}</span
				>
				{labels.toggles[toggle.id] ?? toggle.id}
			{/snippet}
		</ContextMenu.CheckboxItem>
	{/each}
	{#if groups}
		<ContextMenu.Item class="wb-menu-item" onSelect={() => editor.ungroupSelection()}>
			{words.ungroup}<span class="wb-keys" aria-hidden="true"
				><kbd class="wb-key">{mod} ⇧ G</kbd></span
			>
		</ContextMenu.Item>
	{/if}
	{#if selected.length > 0}
		<ContextMenu.Item class="wb-menu-item" onSelect={() => editor.toggleLock()}>
			{locked ? words.unlock : words.lock}
		</ContextMenu.Item>
		<ContextMenu.Item class="wb-menu-item" onSelect={() => editor.zoomToSelection()}>
			{words.zoomToSelection}
		</ContextMenu.Item>
	{:else}
		<ContextMenu.Item class="wb-menu-item" onSelect={() => editor.selectAll()}>
			{words.selectAll}<span class="wb-keys" aria-hidden="true"
				><kbd class="wb-key">{mod} A</kbd></span
			>
		</ContextMenu.Item>
		<ContextMenu.Item class="wb-menu-item" onSelect={() => editor.zoomToFit()}
			>{labels.zoomFit}</ContextMenu.Item
		>
		<ContextMenu.Separator class="wb-menu-rule" />
		<ContextMenu.CheckboxItem
			class="wb-menu-item wb-marked"
			checked={grid.show}
			onCheckedChange={() => editor.grid.set({ ...grid, show: !grid.show })}
		>
			{#snippet children({ checked })}
				<span class="wb-mark" aria-hidden="true"
					>{#if checked}<Check />{/if}</span
				>
				{words.showGrid}
			{/snippet}
		</ContextMenu.CheckboxItem>
		<ContextMenu.CheckboxItem
			class="wb-menu-item wb-marked"
			checked={grid.snap}
			onCheckedChange={() => editor.grid.set({ ...grid, snap: !grid.snap })}
		>
			{#snippet children({ checked })}
				<span class="wb-mark" aria-hidden="true"
					>{#if checked}<Check />{/if}</span
				>
				{words.snapGrid}
			{/snippet}
		</ContextMenu.CheckboxItem>
	{/if}
	{#if movable.length > 0}
		<ContextMenu.Separator class="wb-menu-rule" />
		<ContextMenu.Item class="wb-menu-item" onSelect={() => editor.deleteSelection()}>
			{words.delete}<span class="wb-keys" aria-hidden="true"><kbd class="wb-key">Del</kbd></span>
		</ContextMenu.Item>
	{/if}
{/if}
