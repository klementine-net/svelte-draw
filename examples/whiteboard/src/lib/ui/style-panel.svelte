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
	import { Tooltip } from 'bits-ui';
	import StyleRow from './style-row.svelte';
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
		type SizeName,
		type StyleKey
	} from '@simon-lund/svelte-draw';
	import { defaultLabels, type DrawLabels } from './labels';
	import { useScheme } from './board';

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

	/** What a row needs to show its pick and to set it. */
	function pick<K extends StyleKey>(key: K, read = (value: string) => value as ShapeStyle[K]) {
		return {
			value: String(style[key]),
			onpick: (value: string) => editor.setStyle({ [key]: read(value) } as Partial<ShapeStyle>)
		};
	}
	/** The choices of a row: each value with its name from the labels. */
	const named = <T extends string>(values: readonly T[], words: Record<T, string>) =>
		values.map((value) => ({ value: value as string, label: words[value] }));

	const sizeWeight = { s: 'thin', m: 'regular', l: 'bold', xl: 'fill' } as const;
	const percent = (value: number) => `${Math.round(value * 100)}%`;
	const scheme = useScheme();
</script>

{#if rows.length > 0}
	<Tooltip.Provider delayDuration={500} skipDelayDuration={300}>
		<div
			role="group"
			aria-label={labels.style}
			class={['wb wb-panel', className]}
			data-scheme={scheme()}
		>
			{#if rows.includes('color')}
				<StyleRow label={labels.color} options={named(COLORS, labels.colors)} {...pick('color')}>
					{#snippet item(name)}<span class="wb-swatch" data-color={name}></span>{/snippet}
				</StyleRow>
			{/if}
			{#if rows.includes('fill')}
				<StyleRow label={labels.fill} options={named(FILLS, labels.fills)} {...pick('fill')}>
					{#snippet item(name)}
						{#if name === 'none'}<Circle aria-hidden="true" />
						{:else if name === 'tint'}<CircleHalf aria-hidden="true" />
						{:else if name === 'pattern'}<Circle weight="duotone" aria-hidden="true" />
						{:else}<Circle weight="fill" aria-hidden="true" />{/if}
					{/snippet}
				</StyleRow>
			{/if}
			{#if rows.includes('size')}
				<StyleRow label={labels.size} options={named(SIZES, labels.sizes)} {...pick('size')}>
					{#snippet item(name)}
						<Minus weight={sizeWeight[name as SizeName]} aria-hidden="true" />
					{/snippet}
				</StyleRow>
			{/if}
			{#if rows.includes('look')}
				<StyleRow label={labels.look} options={named(LOOKS, labels.looks)} {...pick('look')}>
					{#snippet item(name)}
						{#if name === 'sketch'}<Scribble aria-hidden="true" />
						{:else if name === 'precise'}<LineSegment aria-hidden="true" />
						{:else}
							<svg class="wb-dash-icon" viewBox="0 0 16 16" aria-hidden="true">
								<path d="M2,8H14" stroke-dasharray={name === 'dashed' ? '3.2 2.4' : '0.1 3'} />
							</svg>
						{/if}
					{/snippet}
				</StyleRow>
			{/if}
			{#if rows.includes('font')}
				<StyleRow label={labels.font} options={named(FONTS, labels.fonts)} {...pick('font')}>
					{#snippet item(name)}
						<span class="wb-font-sample" data-font={name} aria-hidden="true">Aa</span>
					{/snippet}
				</StyleRow>
			{/if}
			{#if rows.includes('align')}
				<StyleRow
					label={labels.align}
					options={named(ALIGNS, labels.aligns)}
					{...pick('align')}
					columns="line"
				>
					{#snippet item(name)}
						{#if name === 'start'}<TextAlignLeft aria-hidden="true" />
						{:else if name === 'middle'}<TextAlignCenter aria-hidden="true" />
						{:else}<TextAlignRight aria-hidden="true" />{/if}
					{/snippet}
				</StyleRow>
			{/if}
			{#if rows.includes('valign')}
				<StyleRow
					label={labels.valign}
					options={named(VALIGNS, labels.valigns)}
					{...pick('valign')}
					columns="line"
				>
					{#snippet item(name)}
						{#if name === 'top'}<AlignTop aria-hidden="true" />
						{:else if name === 'middle'}<AlignCenterVertical aria-hidden="true" />
						{:else}<AlignBottom aria-hidden="true" />{/if}
					{/snippet}
				</StyleRow>
			{/if}
			{#if rows.includes('opacity')}
				<StyleRow
					label={labels.opacity}
					options={OPACITIES.map((value) => ({
						value: String(value),
						label: `${labels.opacity} ${percent(value)}`
					}))}
					{...pick('opacity', Number)}
					columns={5}
				>
					{#snippet item(value)}
						<span class="wb-swatch wb-opacity" style:--wb-opacity={value}></span>
					{/snippet}
				</StyleRow>
			{/if}
		</div>
	</Tooltip.Provider>
{/if}
