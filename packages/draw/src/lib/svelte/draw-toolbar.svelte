<script lang="ts">
	import ArrowUUpLeft from 'phosphor-svelte/lib/ArrowUUpLeft';
	import ArrowUUpRight from 'phosphor-svelte/lib/ArrowUUpRight';
	import CaretUp from 'phosphor-svelte/lib/CaretUp';
	import {
		DropdownMenu,
		DropdownMenuContent,
		DropdownMenuRadioGroup,
		DropdownMenuRadioItem,
		DropdownMenuShortcut,
		DropdownMenuTrigger
	} from '@klementine/ui/dropdown-menu';
	import { Kbd } from '@klementine/ui/kbd';
	import {
		Toolbar,
		ToolbarButton,
		ToolbarGroup,
		ToolbarGroupItem,
		ToolbarSeparator
	} from '@klementine/ui/toolbar';
	import { TooltipProvider } from '@klementine/ui/tooltip';
	import type { Editor } from '../index.ts';
	import Hint from './hint.svelte';
	import type { DrawSveltePlugin, ToolbarItem } from './plugin.ts';
	import { defaultLabels, type DrawLabels } from './labels.ts';

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
	const shown = (place: { group?: string; items: ToolbarItem[] }) =>
		place.items.find((item) => item.tool === lastPicked[place.group ?? '']) ?? place.items[0];
</script>

<TooltipProvider>
	<Toolbar aria-label={labels.tools} class={['shadow-float', className]}>
		<ToolbarGroup
			type="single"
			size="icon"
			aria-label={labels.tools}
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
						<ToolbarGroupItem
							{...props}
							value={item.tool}
							aria-label={item.label}
							aria-keyshortcuts={item.shortcut}
						>
							<item.icon aria-hidden="true" />
						</ToolbarGroupItem>
					{/snippet}
				</Hint>
				{#if place.items.length > 1}
					<DropdownMenu>
						<DropdownMenuTrigger>
							{#snippet child({ props })}
								<ToolbarButton
									{...props}
									size="icon"
									class="-ms-1.5 w-5"
									aria-label={labels.groups[place.group ?? ''] ?? place.group}
								>
									<CaretUp aria-hidden="true" class="size-3" />
								</ToolbarButton>
							{/snippet}
						</DropdownMenuTrigger>
						<DropdownMenuContent side="top" align="center">
							<DropdownMenuRadioGroup
								value={editor.tool}
								onValueChange={(tool) => editor.setTool(tool)}
							>
								{#each place.items as option (option.tool)}
									<DropdownMenuRadioItem value={option.tool} aria-keyshortcuts={option.shortcut}>
										<option.icon aria-hidden="true" />{option.label}
										{#if option.shortcut}
											<DropdownMenuShortcut><Kbd>{option.shortcut}</Kbd></DropdownMenuShortcut>
										{/if}
									</DropdownMenuRadioItem>
								{/each}
							</DropdownMenuRadioGroup>
						</DropdownMenuContent>
					</DropdownMenu>
				{/if}
			{/each}
		</ToolbarGroup>
		{#each actions as action (action.id)}
			<Hint label={action.label}>
				{#snippet control(props)}
					<ToolbarButton
						{...props}
						size="icon"
						aria-label={action.label}
						onclick={() => action.run(editor)}
					>
						<action.icon aria-hidden="true" />
					</ToolbarButton>
				{/snippet}
			</Hint>
		{/each}
		<ToolbarSeparator />
		<Hint label={labels.undo}>
			{#snippet control(props)}
				<ToolbarButton
					{...props}
					size="icon"
					aria-label={labels.undo}
					disabled={!editor.history.canUndo.get()}
					onclick={() => editor.undo()}
				>
					<ArrowUUpLeft aria-hidden="true" />
				</ToolbarButton>
			{/snippet}
		</Hint>
		<Hint label={labels.redo}>
			{#snippet control(props)}
				<ToolbarButton
					{...props}
					size="icon"
					aria-label={labels.redo}
					disabled={!editor.history.canRedo.get()}
					onclick={() => editor.redo()}
				>
					<ArrowUUpRight aria-hidden="true" />
				</ToolbarButton>
			{/snippet}
		</Hint>
	</Toolbar>
</TooltipProvider>
