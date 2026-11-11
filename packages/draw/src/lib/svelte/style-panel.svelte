<script lang="ts">
	import Circle from 'phosphor-svelte/lib/Circle';
	import CircleHalf from 'phosphor-svelte/lib/CircleHalf';
	import LineSegment from 'phosphor-svelte/lib/LineSegment';
	import Minus from 'phosphor-svelte/lib/Minus';
	import Scribble from 'phosphor-svelte/lib/Scribble';
	import { ToggleGroup, ToggleGroupItem } from '@klementine/ui/toggle-group';
	import { TooltipProvider } from '@klementine/ui/tooltip';
	import Hint from './hint.svelte';
	import { COLORS, FILLS, LOOKS, SIZES, type Editor, type ShapeStyle } from '../index.ts';
	import { defaultLabels, type DrawLabels } from './labels.ts';

	/**
	 * StylePanel: the look of what is selected, or of the next shape when nothing is. One row
	 * each for colour, fill, line width and line style; every row always has one pick.
	 *
	 * @example
	 * <StylePanel {editor} />
	 */
	let {
		editor,
		labels = defaultLabels,
		class: className
	}: { editor: Editor; labels?: DrawLabels; class?: string } = $props();

	// The first selected shape speaks for the selection.
	const style = $derived(editor.getSelectedShapes()[0]?.style ?? editor.style.get());

	function row<K extends keyof ShapeStyle>(key: K) {
		return {
			get: () => style[key] as string,
			set: (value: string) => {
				if (value) editor.setStyle({ [key]: value } as Partial<ShapeStyle>);
			}
		};
	}
	const color = row('color');
	const fill = row('fill');
	const size = row('size');
	const look = row('look');

	const sizeWeight = { s: 'light', m: 'regular', l: 'bold' } as const;
</script>

<TooltipProvider>
	<div
		role="group"
		aria-label={labels.style}
		class={['flex w-fit flex-col gap-1 rounded-lg bg-layer p-1.5 shadow-float', className]}
	>
		<ToggleGroup
			type="single"
			variant="quiet"
			size="icon"
			aria-label={labels.color}
			class="grid grid-cols-4 gap-0.5"
			bind:value={color.get, color.set}
		>
			{#each COLORS as name (name)}
				<Hint label={labels.colors[name]} side="left">
					{#snippet control(props)}
						<ToggleGroupItem {...props} value={name} aria-label={labels.colors[name]}>
							<span class="kd-swatch" data-color={name}></span>
						</ToggleGroupItem>
					{/snippet}
				</Hint>
			{/each}
		</ToggleGroup>
		<ToggleGroup
			type="single"
			variant="quiet"
			size="icon"
			aria-label={labels.fill}
			class="flex gap-0.5"
			bind:value={fill.get, fill.set}
		>
			{#each FILLS as name (name)}
				<Hint label={labels.fills[name]} side="left">
					{#snippet control(props)}
						<ToggleGroupItem {...props} value={name} aria-label={labels.fills[name]}>
							{#if name === 'none'}<Circle aria-hidden="true" />
							{:else if name === 'tint'}<CircleHalf aria-hidden="true" />
							{:else}<Circle weight="fill" aria-hidden="true" />{/if}
						</ToggleGroupItem>
					{/snippet}
				</Hint>
			{/each}
		</ToggleGroup>
		<ToggleGroup
			type="single"
			variant="quiet"
			size="icon"
			aria-label={labels.size}
			class="flex gap-0.5"
			bind:value={size.get, size.set}
		>
			{#each SIZES as name (name)}
				<Hint label={labels.sizes[name]} side="left">
					{#snippet control(props)}
						<ToggleGroupItem {...props} value={name} aria-label={labels.sizes[name]}>
							<Minus weight={sizeWeight[name]} aria-hidden="true" />
						</ToggleGroupItem>
					{/snippet}
				</Hint>
			{/each}
		</ToggleGroup>
		<ToggleGroup
			type="single"
			variant="quiet"
			size="icon"
			aria-label={labels.look}
			class="flex gap-0.5"
			bind:value={look.get, look.set}
		>
			{#each LOOKS as name (name)}
				<Hint label={labels.looks[name]} side="left">
					{#snippet control(props)}
						<ToggleGroupItem {...props} value={name} aria-label={labels.looks[name]}>
							{#if name === 'sketch'}<Scribble aria-hidden="true" />
							{:else}<LineSegment aria-hidden="true" />{/if}
						</ToggleGroupItem>
					{/snippet}
				</Hint>
			{/each}
		</ToggleGroup>
	</div>
</TooltipProvider>
