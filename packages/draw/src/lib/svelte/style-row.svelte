<script lang="ts">
	import type { Snippet } from 'svelte';
	import { ToggleGroup, ToggleGroupItem } from '@klementine/ui/toggle-group';
	import Hint from './hint.svelte';

	/**
	 * StyleRow: one row of the style panel: a few choices of which exactly one is picked.
	 * `options` name the choices, `item` draws one (a colour dot, an icon). Picking the picked
	 * one again keeps it: a style always has a value.
	 *
	 * @example
	 * <StyleRow label="Fill" options={fills} value={style.fill} onpick={setFill} class="flex gap-0.5">
	 *   {#snippet item(name)}<Circle weight={name === 'solid' ? 'fill' : 'regular'} />{/snippet}
	 * </StyleRow>
	 */
	let {
		label,
		options,
		value,
		onpick,
		item,
		class: className,
		itemClass
	}: {
		/** What the row sets, read out for the group. */
		label: string;
		options: { value: string; label: string }[];
		value: string;
		onpick: (value: string) => void;
		item: Snippet<[string]>;
		/** How the choices are laid out (a grid or a line). */
		class?: string;
		itemClass?: string;
	} = $props();
</script>

<ToggleGroup
	type="single"
	variant="quiet"
	size="icon"
	aria-label={label}
	class={className}
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
				<ToggleGroupItem
					{...props}
					value={option.value}
					aria-label={option.label}
					class={itemClass}
				>
					{@render item(option.value)}
				</ToggleGroupItem>
			{/snippet}
		</Hint>
	{/each}
</ToggleGroup>
