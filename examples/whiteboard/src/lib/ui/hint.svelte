<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Kbd } from '@klementine/ui/kbd';
	import { Tooltip, TooltipContent, TooltipTrigger } from '@klementine/ui/tooltip';

	/**
	 * Hint: the name of an icon-only control of the canvas, with the key that does the same, as
	 * the design system's Tooltip. The control is the `control` snippet; spread its props on it.
	 * Needs a TooltipProvider above (each bar of Draw brings one).
	 *
	 * @example
	 * <Hint label="Rectangle" shortcut="R">
	 *   {#snippet control(props)}<ToolbarButton {...props} size="icon" aria-label="Rectangle">…</ToolbarButton>{/snippet}
	 * </Hint>
	 */
	let {
		label,
		shortcut,
		side = 'top',
		control
	}: {
		label: string;
		shortcut?: string;
		side?: 'top' | 'right' | 'bottom' | 'left';
		control: Snippet<[Record<string, unknown>]>;
	} = $props();
</script>

<Tooltip>
	<TooltipTrigger>
		{#snippet child({ props })}{@render control(props)}{/snippet}
	</TooltipTrigger>
	<TooltipContent {side} class="flex items-center gap-2">
		{label}
		{#if shortcut}<Kbd surface="charcoal">{shortcut}</Kbd>{/if}
	</TooltipContent>
</Tooltip>
