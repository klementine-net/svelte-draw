<script lang="ts">
	import List from 'phosphor-svelte/lib/List';
	import { afterNavigate } from '$app/navigation';
	import { Dialog } from 'bits-ui';
	import { here, href, REPOSITORY } from '#lib/nav.ts';
	import DocNav from './doc-nav.svelte';

	/**
	 * SiteHeader: the name (home) and the three places, Docs, Demo and GitHub. On a phone the
	 * places and the pages are on a sheet behind Menu.
	 */
	let menu = $state(false);
	// Whatever took the reader to another page, the menu has done its job.
	afterNavigate(() => (menu = false));
	const inDocs = $derived(here().startsWith('/docs/'));
	const place =
		'text-[0.9375rem] leading-5 text-ink2 hover:text-ink aria-[current=page]:text-ink aria-[current=page]:font-semibold';
</script>

<header
	class="sticky top-0 z-20 h-(--site-header) bg-(--paper-veil) backdrop-blur-md supports-[not(backdrop-filter:blur(1px))]:bg-paper"
>
	<div
		class="mx-auto flex h-full max-w-(--site-max) items-center justify-between px-(--site-margin) md:px-8"
	>
		<a href={href('/')} class="text-[0.9375rem] leading-5 font-semibold tracking-[-0.01em]">
			svelte-draw
		</a>
		<nav aria-label="Site" class="hidden items-center gap-7 md:flex">
			<a href={href('/docs/')} class={place} aria-current={inDocs ? 'page' : undefined}>Docs</a>
			<a href={href('/demo/')} class={place}>Demo</a>
			<a href={REPOSITORY} class={place}>GitHub</a>
		</nav>
		<div class="md:hidden">
			<Dialog.Root bind:open={menu}>
				<Dialog.Trigger class="button -mr-3" data-kind="quiet">
					<List aria-hidden="true" />Menu
				</Dialog.Trigger>
				<Dialog.Portal>
					<Dialog.Overlay class="sheet-veil" />
					<Dialog.Content class="sheet">
						<Dialog.Title class="sheet-title">svelte-draw</Dialog.Title>
						<div class="sheet-body">
							<nav aria-label="Site" class="flex flex-col gap-1">
								<a href={href('/')} class="py-2 text-title">Home</a>
								<a href={href('/demo/')} class="py-2 text-title">Demo</a>
								<a href={REPOSITORY} class="py-2 text-title">GitHub</a>
							</nav>
							<DocNav />
						</div>
					</Dialog.Content>
				</Dialog.Portal>
			</Dialog.Root>
		</div>
	</div>
</header>
