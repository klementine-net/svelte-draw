<script lang="ts">
	import { here } from '#lib/nav.ts';
	import '@fontsource/instrument-sans/400.css';
	import '@fontsource/instrument-sans/500.css';
	import '@fontsource/instrument-sans/600.css';
	import '@fontsource/jetbrains-mono/400.css';
	import '@fontsource/caveat/600.css';
	import '../app.css';
	import type { Snippet } from 'svelte';
	import DocNav from '#lib/components/doc-nav.svelte';
	import SiteHeader from '#lib/components/site-header.svelte';

	/* The frame of every page: the header, and on documentation pages the list of pages. */
	let { children }: { children: Snippet } = $props();

	const inDocs = $derived(here().startsWith('/docs/'));
</script>

<SiteHeader />

{#if inDocs}
	<div
		class="mx-auto grid max-w-(--site-max) px-(--site-margin) pt-8 pb-24 md:grid-cols-[var(--site-sidebar)_minmax(0,1fr)] md:gap-(--site-gap) md:px-8 md:pt-12"
	>
		<aside class="hidden md:block">
			<div class="sticky top-[calc(var(--site-header)+3rem)]">
				<DocNav />
			</div>
		</aside>
		<main class="min-w-0">
			{@render children()}
		</main>
	</div>
{:else}
	{@render children()}
{/if}
