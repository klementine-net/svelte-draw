<script lang="ts">
	import Circle from 'phosphor-svelte/lib/Circle';
	import CircleHalf from 'phosphor-svelte/lib/CircleHalf';
	import LineSegment from 'phosphor-svelte/lib/LineSegment';
	import Minus from 'phosphor-svelte/lib/Minus';
	import Scribble from 'phosphor-svelte/lib/Scribble';
	import AlignBottom from 'phosphor-svelte/lib/AlignBottom';
	import AlignCenterVertical from 'phosphor-svelte/lib/AlignCenterVertical';
	import AlignTop from 'phosphor-svelte/lib/AlignTop';
	import TextAlignCenter from 'phosphor-svelte/lib/TextAlignCenter';
	import TextAlignLeft from 'phosphor-svelte/lib/TextAlignLeft';
	import TextAlignRight from 'phosphor-svelte/lib/TextAlignRight';
	import { ToggleGroup, ToggleGroupItem } from '@klementine/ui/toggle-group';
	import { TooltipProvider } from '@klementine/ui/tooltip';
	import Hint from './hint.svelte';
	import {
		ALIGNS,
		COLORS,
		DEFAULT_STYLE,
		FILLS,
		FONTS,
		LOOKS,
		OPACITIES,
		SIZES,
		VALIGNS,
		type Editor,
		type ShapeStyle,
		type StyleKey
	} from '../index.ts';
	import { defaultLabels, type DrawLabels } from './labels.ts';

	/**
	 * StylePanel: the look of what is selected, or of the next shape when nothing is. One row
	 * for each style the selected kinds have (a line has no fill, a text has a typeface); every
	 * row always has one pick. Nothing shows for kinds with no styles (a frame).
	 *
	 * @example
	 * <StylePanel {editor} />
	 */
	let {
		editor,
		labels = defaultLabels,
		class: className
	}: { editor: Editor; labels?: DrawLabels; class?: string } = $props();

	// What is in a selected group speaks for the group.
	const shapes = $derived(editor.getLeaves(editor.getSelectedShapes()));
	// The first selected shape speaks for the selection.
	const style = $derived({ ...DEFAULT_STYLE, ...(shapes[0]?.style ?? editor.style.get()) });
	const rows = $derived.by(() => {
		const order: StyleKey[] = [
			'color',
			'fill',
			'size',
			'look',
			'font',
			'align',
			'valign',
			'opacity'
		];
		if (shapes.length === 0) {
			// Nothing selected: the styles of what the picked tool is most likely to make.
			const text = editor.tool === 'text';
			return order.filter((key) =>
				text
					? key !== 'fill' && key !== 'look' && key !== 'valign'
					: key !== 'font' && key !== 'align' && key !== 'valign'
			);
		}
		const used = new Set(shapes.flatMap((shape) => editor.util(shape.kind).styles));
		return order.filter((key) => used.has(key));
	});

	function row<K extends StyleKey>(key: K, read = (value: string) => value as ShapeStyle[K]) {
		return {
			get: () => String(style[key]),
			set: (value: string) => {
				if (value) editor.setStyle({ [key]: read(value) } as Partial<ShapeStyle>);
			}
		};
	}
	const color = row('color');
	const fill = row('fill');
	const size = row('size');
	const look = row('look');
	const font = row('font');
	const align = row('align');
	const valign = row('valign');
	const opacity = row('opacity', Number);

	const sizeWeight = { s: 'thin', m: 'regular', l: 'bold', xl: 'fill' } as const;
	const percent = (value: number) => `${Math.round(value * 100)}%`;
</script>

{#if rows.length > 0}
	<TooltipProvider>
		<div
			role="group"
			aria-label={labels.style}
			class={['flex w-fit flex-col gap-1 rounded-lg bg-layer p-1.5 shadow-float', className]}
		>
			{#if rows.includes('color')}
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
			{/if}
			{#if rows.includes('fill')}
				<ToggleGroup
					type="single"
					variant="quiet"
					size="icon"
					aria-label={labels.fill}
					class="grid grid-cols-4 gap-0.5"
					bind:value={fill.get, fill.set}
				>
					{#each FILLS as name (name)}
						<Hint label={labels.fills[name]} side="left">
							{#snippet control(props)}
								<ToggleGroupItem {...props} value={name} aria-label={labels.fills[name]}>
									{#if name === 'none'}<Circle aria-hidden="true" />
									{:else if name === 'tint'}<CircleHalf aria-hidden="true" />
									{:else if name === 'pattern'}<Circle weight="duotone" aria-hidden="true" />
									{:else}<Circle weight="fill" aria-hidden="true" />{/if}
								</ToggleGroupItem>
							{/snippet}
						</Hint>
					{/each}
				</ToggleGroup>
			{/if}
			{#if rows.includes('size')}
				<ToggleGroup
					type="single"
					variant="quiet"
					size="icon"
					aria-label={labels.size}
					class="grid grid-cols-4 gap-0.5"
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
			{/if}
			{#if rows.includes('look')}
				<ToggleGroup
					type="single"
					variant="quiet"
					size="icon"
					aria-label={labels.look}
					class="grid grid-cols-4 gap-0.5"
					bind:value={look.get, look.set}
				>
					{#each LOOKS as name (name)}
						<Hint label={labels.looks[name]} side="left">
							{#snippet control(props)}
								<ToggleGroupItem {...props} value={name} aria-label={labels.looks[name]}>
									{#if name === 'sketch'}<Scribble aria-hidden="true" />
									{:else if name === 'precise'}<LineSegment aria-hidden="true" />
									{:else}
										<svg class="kd-dash-icon" viewBox="0 0 16 16" aria-hidden="true">
											<path
												d="M2,8H14"
												stroke-dasharray={name === 'dashed' ? '3.2 2.4' : '0.1 3'}
											/>
										</svg>
									{/if}
								</ToggleGroupItem>
							{/snippet}
						</Hint>
					{/each}
				</ToggleGroup>
			{/if}
			{#if rows.includes('font')}
				<ToggleGroup
					type="single"
					variant="quiet"
					size="icon"
					aria-label={labels.font}
					class="grid grid-cols-4 gap-0.5"
					bind:value={font.get, font.set}
				>
					{#each FONTS as name (name)}
						<Hint label={labels.fonts[name]} side="left">
							{#snippet control(props)}
								<ToggleGroupItem {...props} value={name} aria-label={labels.fonts[name]}>
									<span class="kd-font-sample" data-font={name} aria-hidden="true">Aa</span>
								</ToggleGroupItem>
							{/snippet}
						</Hint>
					{/each}
				</ToggleGroup>
			{/if}
			{#if rows.includes('align')}
				<ToggleGroup
					type="single"
					variant="quiet"
					size="icon"
					aria-label={labels.align}
					class="flex gap-0.5"
					bind:value={align.get, align.set}
				>
					{#each ALIGNS as name (name)}
						<Hint label={labels.aligns[name]} side="left">
							{#snippet control(props)}
								<ToggleGroupItem {...props} value={name} aria-label={labels.aligns[name]}>
									{#if name === 'start'}<TextAlignLeft aria-hidden="true" />
									{:else if name === 'middle'}<TextAlignCenter aria-hidden="true" />
									{:else}<TextAlignRight aria-hidden="true" />{/if}
								</ToggleGroupItem>
							{/snippet}
						</Hint>
					{/each}
				</ToggleGroup>
			{/if}
			{#if rows.includes('valign')}
				<ToggleGroup
					type="single"
					variant="quiet"
					size="icon"
					aria-label={labels.valign}
					class="flex gap-0.5"
					bind:value={valign.get, valign.set}
				>
					{#each VALIGNS as name (name)}
						<Hint label={labels.valigns[name]} side="left">
							{#snippet control(props)}
								<ToggleGroupItem {...props} value={name} aria-label={labels.valigns[name]}>
									{#if name === 'top'}<AlignTop aria-hidden="true" />
									{:else if name === 'middle'}<AlignCenterVertical aria-hidden="true" />
									{:else}<AlignBottom aria-hidden="true" />{/if}
								</ToggleGroupItem>
							{/snippet}
						</Hint>
					{/each}
				</ToggleGroup>
			{/if}
			{#if rows.includes('opacity')}
				<ToggleGroup
					type="single"
					variant="quiet"
					size="icon"
					aria-label={labels.opacity}
					class="grid grid-cols-5 gap-0"
					bind:value={opacity.get, opacity.set}
				>
					{#each OPACITIES as value (value)}
						<Hint label="{labels.opacity} {percent(value)}" side="left">
							{#snippet control(props)}
								<ToggleGroupItem
									{...props}
									value={String(value)}
									aria-label="{labels.opacity} {percent(value)}"
									class="w-auto min-w-0 px-0"
								>
									<span class="kd-swatch kd-opacity" style:--kd-opacity={value}></span>
								</ToggleGroupItem>
							{/snippet}
						</Hint>
					{/each}
				</ToggleGroup>
			{/if}
		</div>
	</TooltipProvider>
{/if}
