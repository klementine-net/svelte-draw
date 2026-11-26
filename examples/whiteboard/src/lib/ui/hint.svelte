<script lang="ts">
	import { Tooltip } from 'bits-ui';
	import type { Snippet } from 'svelte';
	import { useScheme } from './board.ts';

	/**
	 * Hint: the name of an icon-only control, with the key that does the same, shown beside it
	 * when it is pointed at or focused. The control is the `control` snippet; spread its props on
	 * it. Needs a `Tooltip.Provider` above (each bar brings one).
	 *
	 * @example
	 * <Hint label="Rectangle" shortcut="R">
	 *   {#snippet control(props)}<button {...props} class="wb-item" aria-label="Rectangle">…</button>{/snippet}
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

	const scheme = useScheme();
</script>

<Tooltip.Root>
	<Tooltip.Trigger>
		{#snippet child({ props })}{@render control(props)}{/snippet}
	</Tooltip.Trigger>
	<Tooltip.Portal>
		<Tooltip.Content {side} sideOffset={6} class="wb wb-tip" data-scheme={scheme()}>
			{label}
			{#if shortcut}<kbd class="wb-key">{shortcut}</kbd>{/if}
		</Tooltip.Content>
	</Tooltip.Portal>
</Tooltip.Root>
