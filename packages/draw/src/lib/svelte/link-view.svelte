<script lang="ts">
	import ArrowSquareOut from 'phosphor-svelte/lib/ArrowSquareOut';
	import { embedUrl, type LinkShape } from '../index.ts';
	import type { ShapeViewProps } from './plugin.ts';

	/**
	 * LinkView: a web address. A known video shows its player, any other address a card with
	 * where it leads. Like every shape it is moved and resized by the canvas; a double click
	 * makes it live (the card can be followed, the player played) until Escape.
	 */
	let { shape, editor }: ShapeViewProps<LinkShape> = $props();

	const player = $derived(embedUrl(shape.props.url));
	const live = $derived(editor.editing.get() === shape.id);
	// A document can come from anywhere: only a web address is given to the browser to follow.
	const followable = $derived(/^https?:\/\//i.test(shape.props.url));
	const host = $derived.by(() => {
		try {
			return new URL(shape.props.url).hostname.replace(/^www\./, '');
		} catch {
			return shape.props.url;
		}
	});
</script>

<div
	class="kd-link"
	data-live={live || undefined}
	style:width="{shape.props.w}px"
	style:height="{shape.props.h}px"
>
	{#if player}
		<iframe
			src={player}
			title={host}
			loading="lazy"
			allow="fullscreen; picture-in-picture"
			referrerpolicy="strict-origin-when-cross-origin"
		></iframe>
	{:else}
		<a
			href={followable ? shape.props.url : undefined}
			target="_blank"
			rel="noopener noreferrer"
			tabindex={live ? 0 : -1}
		>
			<span class="kd-link-host">{host}<ArrowSquareOut aria-hidden="true" /></span>
			<span class="kd-link-url">{shape.props.url}</span>
		</a>
	{/if}
</div>
