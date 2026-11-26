<script lang="ts">
	import ArrowUUpLeft from 'phosphor-svelte/lib/ArrowUUpLeft';
	import ArrowUUpRight from 'phosphor-svelte/lib/ArrowUUpRight';
	import CaretUp from 'phosphor-svelte/lib/CaretUp';
	import { DropdownMenu, Toolbar, Tooltip } from 'bits-ui';
	import type { DrawSveltePlugin, Editor, ToolbarItem } from '@klementine/svelte-draw';
	import Hint from './hint.svelte';
	import { defaultLabels, type DrawLabels } from './labels';
	import { toCanvas, useScheme } from './board';

	/**
	 * DrawToolbar: the tools of every plugin in one bar, then undo and redo. The picked tool is
	 * the editor's; picking here and pressing a tool's key are the same thing.
	 *
	 * @example
	 * <DrawToolbar {editor} plugins={defaultPlugins} />
	 */
	let {
		editor,
		plugins,
		labels = defaultLabels,
		class: className
	}: {
		editor: Editor;
		plugins: DrawSveltePlugin[];
		labels?: DrawLabels;
		class?: string;
	} = $props();

	const items = $derived(plugins.flatMap((plugin) => plugin.toolbar ?? []));
	const actions = $derived(plugins.flatMap((plugin) => plugin.actions ?? []));

	// One place in the bar per tool, or per group of tools (at the group's first tool).
	const places = $derived.by(() => {
		const out: { key: string; group?: string; items: ToolbarItem[] }[] = [];
		for (const item of items) {
			const place = item.group ? out.find((p) => p.group === item.group) : undefined;
			if (place) place.items.push(item);
			else out.push({ key: item.group ?? item.tool, group: item.group, items: [item] });
		}
		return out;
	});

	// The tool a group shows: the one picked from it last (its first, until one is picked).
	// Worked out with the picked tool, in the same render: a key that picks a tool of a group
	// shows it in the bar at once. `memory` only records what was picked; it shows nothing itself.
	const memory: Record<string, string> = {};
	const lastPicked = $derived.by(() => {
		const active = items.find((item) => item.tool === editor.tool);
		if (active?.group) memory[active.group] = active.tool;
		return { ...memory };
	});
	const scheme = useScheme();
	let bar = $state<HTMLElement | null>(null);
	const shown = (place: { group?: string; items: ToolbarItem[] }) =>
		place.items.find((item) => item.tool === lastPicked[place.group ?? '']) ?? place.items[0];
</script>

<Tooltip.Provider delayDuration={500} skipDelayDuration={300}>
	<Toolbar.Root
		bind:ref={bar}
		aria-label={labels.tools}
		class={['wb wb-bar', className]}
		data-scheme={scheme()}
	>
		<Toolbar.Group
			type="single"
			aria-label={labels.tools}
			class="wb-group"
			bind:value={
				() => editor.tool,
				(tool) => {
					// Pressing the picked tool again keeps it: there is always a tool.
					if (tool) editor.setTool(tool);
				}
			}
		>
			{#each places as place (place.key)}
				{@const item = shown(place)}
				<Hint label={item.label} shortcut={item.shortcut}>
					{#snippet control(props)}
						<Toolbar.GroupItem
							{...props}
							value={item.tool}
							aria-label={item.label}
							aria-keyshortcuts={item.shortcut}
							class="wb-item"
						>
							<item.icon aria-hidden="true" />
						</Toolbar.GroupItem>
					{/snippet}
				</Hint>
				{#if place.items.length > 1}
					<DropdownMenu.Root>
						<DropdownMenu.Trigger>
							{#snippet child({ props })}
								<Toolbar.Button
									{...props}
									class="wb-item wb-caret"
									aria-label={labels.groups[place.group ?? ''] ?? place.group}
								>
									<CaretUp aria-hidden="true" />
								</Toolbar.Button>
							{/snippet}
						</DropdownMenu.Trigger>
						<DropdownMenu.Portal>
							<DropdownMenu.Content
								side="top"
								align="center"
								sideOffset={6}
								collisionPadding={8}
								class="wb wb-menu"
								data-scheme={scheme()}
								onCloseAutoFocus={(event) => toCanvas(event, bar)}
							>
								<DropdownMenu.RadioGroup
									value={editor.tool}
									onValueChange={(tool) => editor.setTool(tool)}
								>
									{#each place.items as option (option.tool)}
										<DropdownMenu.RadioItem
											value={option.tool}
											aria-keyshortcuts={option.shortcut}
											class="wb-menu-item wb-marked"
										>
											{#snippet children({ checked })}
												<span class="wb-mark" aria-hidden="true">
													{#if checked}<span class="wb-dot"></span>{/if}
												</span>
												<option.icon aria-hidden="true" />{option.label}
												{#if option.shortcut}
													<span class="wb-keys" aria-hidden="true"
														><kbd class="wb-key">{option.shortcut}</kbd></span
													>
												{/if}
											{/snippet}
										</DropdownMenu.RadioItem>
									{/each}
								</DropdownMenu.RadioGroup>
							</DropdownMenu.Content>
						</DropdownMenu.Portal>
					</DropdownMenu.Root>
				{/if}
			{/each}
		</Toolbar.Group>
		{#each actions as action (action.id)}
			<Hint label={action.label}>
				{#snippet control(props)}
					<Toolbar.Button
						{...props}
						class="wb-item"
						aria-label={action.label}
						onclick={() => action.run(editor)}
					>
						<action.icon aria-hidden="true" />
					</Toolbar.Button>
				{/snippet}
			</Hint>
		{/each}
		<span class="wb-rule" role="separator" aria-orientation="vertical"></span>
		<Hint label={labels.undo}>
			{#snippet control(props)}
				<Toolbar.Button
					{...props}
					class="wb-item"
					aria-label={labels.undo}
					disabled={!editor.history.canUndo.get()}
					onclick={() => editor.undo()}
				>
					<ArrowUUpLeft aria-hidden="true" />
				</Toolbar.Button>
			{/snippet}
		</Hint>
		<Hint label={labels.redo}>
			{#snippet control(props)}
				<Toolbar.Button
					{...props}
					class="wb-item"
					aria-label={labels.redo}
					disabled={!editor.history.canRedo.get()}
					onclick={() => editor.redo()}
				>
					<ArrowUUpRight aria-hidden="true" />
				</Toolbar.Button>
			{/snippet}
		</Hint>
	</Toolbar.Root>
</Tooltip.Provider>
