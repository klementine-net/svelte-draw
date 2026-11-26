<script lang="ts">
	import CornersOut from 'phosphor-svelte/lib/CornersOut';
	import Minus from 'phosphor-svelte/lib/Minus';
	import Plus from 'phosphor-svelte/lib/Plus';
	import { Toolbar, Tooltip } from 'bits-ui';
	import type { Editor } from '@simon-lund/svelte-draw';
	import Hint from './hint.svelte';
	import { defaultLabels, type DrawLabels } from './labels';
	import { useScheme } from './board';

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
	const scheme = useScheme();
</script>

<Tooltip.Provider delayDuration={500} skipDelayDuration={300}>
	<Toolbar.Root aria-label={labels.zoom} class={['wb wb-bar', className]} data-scheme={scheme()}>
		<Hint label={labels.zoomOut}>
			{#snippet control(props)}
				<Toolbar.Button
					{...props}
					class="wb-item"
					aria-label={labels.zoomOut}
					onclick={() => editor.zoomOut()}
				>
					<Minus aria-hidden="true" />
				</Toolbar.Button>
			{/snippet}
		</Hint>
		<Hint label={labels.zoomReset}>
			{#snippet control(props)}
				<Toolbar.Button
					{...props}
					aria-label="{labels.zoomReset} ({percent}%)"
					class="wb-item wb-text wb-percent"
					onclick={() => editor.resetZoom()}
				>
					{percent}%
				</Toolbar.Button>
			{/snippet}
		</Hint>
		<Hint label={labels.zoomIn}>
			{#snippet control(props)}
				<Toolbar.Button
					{...props}
					class="wb-item"
					aria-label={labels.zoomIn}
					onclick={() => editor.zoomIn()}
				>
					<Plus aria-hidden="true" />
				</Toolbar.Button>
			{/snippet}
		</Hint>
		<Hint label={labels.zoomFit}>
			{#snippet control(props)}
				<Toolbar.Button
					{...props}
					class="wb-item"
					aria-label={labels.zoomFit}
					onclick={() => editor.zoomToFit()}
				>
					<CornersOut aria-hidden="true" />
				</Toolbar.Button>
			{/snippet}
		</Hint>
	</Toolbar.Root>
</Tooltip.Provider>
