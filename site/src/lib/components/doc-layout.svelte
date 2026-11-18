<script lang="ts">
	import ArrowLeft from 'phosphor-svelte/lib/ArrowLeft';
	import ArrowRight from 'phosphor-svelte/lib/ArrowRight';
	import type { Snippet } from 'svelte';
	import { here, href, locate, REPOSITORY } from '#lib/nav.ts';

	/**
	 * DocLayout: one page of the documentation: its title and the sentence on what it is for (both
	 * from the page list in nav.ts), the text, then the way on (the next and previous page) and
	 * where to change it. Markdown pages get it through mdsvex; Svelte pages wrap themselves in it.
	 */
	let { children }: { children?: Snippet } = $props();

	const at = $derived(locate(here()));
</script>

<svelte:head>
	<title>{at.page ? `${at.page.title} · Klementine Draw` : 'Klementine Draw'}</title>
	{#if at.page}<meta name="description" content={at.page.summary} />{/if}
</svelte:head>

<article class="prose min-w-0">
	{#if at.page}
		<h1>{at.page.title}</h1>
		<p class="text-cream-ink2 !mt-3 text-title font-normal">{at.page.summary}</p>
	{/if}
	<div class="doc-body">
		{@render children?.()}
	</div>
</article>

<footer class="mt-16 max-w-(--site-column) border-t border-(--line) pt-6">
	<nav aria-label="Pages" class="grid grid-cols-2 gap-4">
		{#if at.previous}
			<a href={href(at.previous.path)} class="group flex flex-col gap-1">
				<span class="text-cream-ink3 flex items-center gap-1 text-label"
					><ArrowLeft aria-hidden="true" class="size-3.5" />Previous</span
				>
				<span class="text-[0.9375rem] font-semibold group-hover:underline">{at.previous.title}</span
				>
			</a>
		{:else}
			<span></span>
		{/if}
		{#if at.next}
			<a href={href(at.next.path)} class="group flex flex-col items-end gap-1 text-right">
				<span class="text-cream-ink3 flex items-center gap-1 text-label"
					>Next<ArrowRight aria-hidden="true" class="size-3.5" /></span
				>
				<span class="text-[0.9375rem] font-semibold group-hover:underline">{at.next.title}</span>
			</a>
		{/if}
	</nav>
	{#if at.page}
		<p class="text-cream-ink3 mt-8 text-label">
			<a href="{REPOSITORY}/edit/main/{at.page.source}" class="underline-offset-2 hover:underline"
				>Edit this page on GitHub</a
			>
		</p>
	{/if}
</footer>
