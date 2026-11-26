<script lang="ts">
	import { ToggleGroup } from 'bits-ui';
	import type { Snippet } from 'svelte';
	import Hint from './hint.svelte';

	/**
	 * StyleRow: one row of the style panel: a few choices of which exactly one is picked.
	 * `options` name the choices, `item` draws one (a colour dot, an icon). Picking the picked
	 * one again keeps it: a style always has a value.
	 *
	 * @example
	 * <StyleRow label="Fill" options={fills} value={style.fill} onpick={setFill}>
	 *   {#snippet item(name)}<Circle weight={name === 'solid' ? 'fill' : 'regular'} />{/snippet}
	 * </StyleRow>
	 */
	let {
		label,
		options,
		value,
		onpick,
		item,
		columns = 4
	}: {
		/** What the row sets, read out for the group. */
		label: string;
		options: { value: string; label: string }[];
		value: string;
		onpick: (value: string) => void;
		item: Snippet<[string]>;
		/** How the choices are laid out: four or five in a row of the grid, or one line. */
		columns?: 4 | 5 | 'line';
	} = $props();
</script>

<ToggleGroup.Root
	type="single"
	aria-label={label}
	class="wb-choices"
	data-columns={columns}
	bind:value={
		() => value,
		(next) => {
			if (next) onpick(next);
		}
	}
>
	{#each options as option (option.value)}
		<Hint label={option.label} side="left">
			{#snippet control(props)}
				<ToggleGroup.Item {...props} value={option.value} aria-label={option.label} class="wb-item">
					{@render item(option.value)}
				</ToggleGroup.Item>
			{/snippet}
		</Hint>
	{/each}
</ToggleGroup.Root>
