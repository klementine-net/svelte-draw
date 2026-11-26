<script lang="ts">
	import CornersOut from 'phosphor-svelte/lib/CornersOut';
	import Minus from 'phosphor-svelte/lib/Minus';
	import Plus from 'phosphor-svelte/lib/Plus';
	import { Toolbar, ToolbarButton } from '@klementine/ui/toolbar';
	import { TooltipProvider } from '@klementine/ui/tooltip';
	import type { Editor } from '@simon-lund/svelte-draw';
	import Hint from './hint.svelte';
	import { defaultLabels, type DrawLabels } from './labels.ts';

	/**
	 * ZoomControl: out, the zoom in percent (press it to go back to 100%), in, and show
	 * everything.
	 *
	 * @example
	 * <ZoomControl {editor} />
	 */
	let {
		editor,
		labels = defaultLabels,
		class: className
	}: { editor: Editor; labels?: DrawLabels; class?: string } = $props();

	const percent = $derived(Math.round(editor.camera.get().z * 100));
</script>

<TooltipProvider>
	<Toolbar aria-label={labels.zoom} class={['shadow-float', className]}>
		<Hint label={labels.zoomOut}>
			{#snippet control(props)}
				<ToolbarButton
					{...props}
					size="icon"
					aria-label={labels.zoomOut}
					onclick={() => editor.zoomOut()}
				>
					<Minus aria-hidden="true" />
				</ToolbarButton>
			{/snippet}
		</Hint>
		<Hint label={labels.zoomReset}>
			{#snippet control(props)}
				<ToolbarButton
					{...props}
					aria-label="{labels.zoomReset} ({percent}%)"
					class="w-16 justify-center tabular-nums"
					onclick={() => editor.resetZoom()}
				>
					{percent}%
				</ToolbarButton>
			{/snippet}
		</Hint>
		<Hint label={labels.zoomIn}>
			{#snippet control(props)}
				<ToolbarButton
					{...props}
					size="icon"
					aria-label={labels.zoomIn}
					onclick={() => editor.zoomIn()}
				>
					<Plus aria-hidden="true" />
				</ToolbarButton>
			{/snippet}
		</Hint>
		<Hint label={labels.zoomFit}>
			{#snippet control(props)}
				<ToolbarButton
					{...props}
					size="icon"
					aria-label={labels.zoomFit}
					onclick={() => editor.zoomToFit()}
				>
					<CornersOut aria-hidden="true" />
				</ToolbarButton>
			{/snippet}
		</Hint>
	</Toolbar>
</TooltipProvider>
