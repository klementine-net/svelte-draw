<script lang="ts">
	import ArrowRight from 'phosphor-svelte/lib/ArrowRight';
	import { buttonVariants } from '@klementine/ui/button';
	import EarlyNotice from '#lib/components/early-notice.svelte';
	import LiveCanvas from '#lib/components/live-canvas.svelte';
	import { homeBoard, phoneTools, plugins } from '#lib/home-board.ts';
	import { href, REPOSITORY } from '#lib/nav.ts';

	/*
	 * Home: what Draw is in one sentence, a board to draw on to see that it works, and the way
	 * in. Below, how to start, how it is built and where it stands, each in a few lines.
	 */
	const editor = homeBoard();

	// (The closing tag is put together, or it would end this very script.)
	const start = `<script lang="ts">
	import { Draw } from '@klementine/draw/svelte';
</${'script'}>

<div class="h-dvh">
	<Draw persistenceKey="my-board" />
</div>`;
</script>

<svelte:head>
	<title>Klementine Draw: an infinite canvas for Svelte</title>
	<meta
		name="description"
		content="A whiteboard engine for Svelte: draw, write, connect shapes with arrows, add pictures, on several pages, kept in the browser and in step across tabs. Shapes and tools are plugins."
	/>
</svelte:head>

<main>
	<section class="mx-auto max-w-(--site-max) px-(--site-margin) pt-12 md:px-8 md:pt-20">
		<h1
			class="max-w-[16ch] text-[2.5rem] leading-[2.75rem] font-semibold tracking-[-0.04em] md:text-[3.5rem] md:leading-[3.75rem]"
		>
			An infinite canvas for Svelte.
		</h1>
		<p class="text-cream-ink2 mt-5 max-w-[36rem] text-title md:text-[1.1875rem] md:leading-7">
			Draw, write, connect shapes with arrows, add pictures, on as many pages as you like. A plain
			TypeScript engine with a Svelte layer on top, and every shape and tool is a plugin.
		</p>
		<div class="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
			<a href={href('/docs/start/')} class={buttonVariants({ variant: 'primary', size: 'sm' })}>
				Get started
			</a>
			<a href={href('/demo/')} class="more !mt-0"
				>Open the full demo<ArrowRight aria-hidden="true" /></a
			>
		</div>
	</section>

	<section aria-label="Try it" class="mx-auto mt-10 max-w-(--site-max) md:mt-14 md:px-8">
		<LiveCanvas
			{editor}
			{plugins}
			tools={phoneTools}
			label="A whiteboard to try Draw on"
			class="h-[26rem] md:h-[32rem]"
		/>
		<p class="text-cream-ink3 mt-3 px-(--site-margin) text-label font-normal md:px-0">
			This board is the library itself, running in the page. Nothing you draw here is kept.
		</p>
	</section>

	<div
		class="mx-auto grid max-w-(--site-max) grid-cols-[minmax(0,1fr)] gap-14 px-(--site-margin) pt-20 pb-24 md:grid-cols-2 md:gap-x-12 md:gap-y-16 md:px-8"
	>
		<section class="grid grid-cols-[minmax(0,1fr)] gap-x-12 md:col-span-2 md:grid-cols-2">
			<div>
				<h2 class="text-headline font-semibold tracking-[-0.02em]">Start</h2>
				<p class="text-cream-ink2 mt-3 leading-[1.625]">
					Install it, and one component is a whole whiteboard: canvas, toolbar, styles, pages. Give
					it a name and it keeps the board in the browser.
				</p>
				<pre class="code !mb-0"><code>npm install @klementine/draw @klementine/ui</code></pre>
				<a href={href('/docs/start/')} class="more"
					>Getting started<ArrowRight aria-hidden="true" /></a
				>
			</div>
			<pre class="code mt-5 self-start md:mt-11"><code>{start}</code></pre>
		</section>
		<section>
			<h2 class="text-headline font-semibold tracking-[-0.02em]">How it is built</h2>
			<p class="text-cream-ink2 mt-3 leading-[1.625]">
				Everything on the board is a plain record in one store, and every change is a diff. Undo,
				saving and sharing are listeners on that stream. A kind of shape is one class, a tool is a
				small state machine, and both come in as plugins. The engine has no idea Svelte exists, so
				it runs in a test or on a server just the same.
			</p>
			<a href={href('/docs/concepts/')} class="more"
				>How it is built<ArrowRight aria-hidden="true" /></a
			>
		</section>
		<section>
			<h2 class="text-headline font-semibold tracking-[-0.02em]">Where it stands</h2>
			<div class="mt-4"><EarlyNotice /></div>
			<ul class="text-cream-ink2 mt-4 flex flex-col gap-2 leading-[1.625]">
				<li>Built with AI: coding agents write the code, the tests and the docs.</li>
				<li>Tabs of one browser stay in step; syncing through a server is not built yet.</li>
				<li>MIT licensed.</li>
			</ul>
			<a href={href('/docs/features/')} class="more"
				>What is built<ArrowRight aria-hidden="true" /></a
			>
		</section>
	</div>

	<footer class="mx-auto max-w-(--site-max) px-(--site-margin) md:px-8">
		<p class="text-cream-ink3 border-t border-(--line) py-8 text-label font-normal">
			Klementine Draw, MIT licensed. <a href={REPOSITORY} class="underline underline-offset-2"
				>Source on GitHub</a
			>.
		</p>
	</footer>
</main>

<style>
	/* The way on from a section: a link that looks like one. */
	.more {
		margin-top: 1rem;
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.9375rem;
		font-weight: 600;
		text-decoration: underline;
		text-decoration-thickness: 1px;
		text-underline-offset: 0.25em;
		text-decoration-color: var(--line-strong);
	}
	.more:hover {
		text-decoration-color: currentColor;
	}
	.more :global(svg) {
		width: 0.875rem;
		height: 0.875rem;
	}
</style>
