<script lang="ts">
	import List from 'phosphor-svelte/lib/List';
	import { afterNavigate } from '$app/navigation';
	import { Button } from '@klementine/ui/button';
	import {
		Drawer,
		DrawerBody,
		DrawerContent,
		DrawerHeader,
		DrawerTitle,
		DrawerTrigger
	} from '@klementine/ui/drawer';
	import { here, href, REPOSITORY } from '#lib/nav.ts';
	import DocNav from './doc-nav.svelte';

	/**
	 * SiteHeader: the name (home) and the three places, Docs, Demo and GitHub. On a phone the
	 * places and the pages are in a drawer behind Menu.
	 */
	let menu = $state(false);
	// Whatever took the reader to another page, the menu has done its job.
	afterNavigate(() => (menu = false));
	const inDocs = $derived(here().startsWith('/docs/'));
	const place =
		'text-[0.9375rem] leading-5 text-cream-ink2 hover:text-cream-ink aria-[current=page]:text-cream-ink aria-[current=page]:font-semibold';
</script>

<header
	class="supports-[not(backdrop-filter:blur(1px))]:bg-canvas-ground sticky top-0 z-20 h-(--site-header) bg-(--canvas-veil) backdrop-blur-md"
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
			<Drawer direction="right" bind:open={menu}>
				<DrawerTrigger>
					{#snippet child({ props })}
						<Button {...props} variant="quiet" size="sm" class="-mr-3">
							<List aria-hidden="true" />Menu
						</Button>
					{/snippet}
				</DrawerTrigger>
				<DrawerContent>
					<DrawerHeader>
						<DrawerTitle>svelte-draw</DrawerTitle>
					</DrawerHeader>
					<DrawerBody class="flex flex-col gap-8 pb-8">
						<nav aria-label="Site" class="flex flex-col gap-1">
							<a href={href('/')} class="py-2 text-title">Home</a>
							<a href={href('/demo/')} class="py-2 text-title">Demo</a>
							<a href={REPOSITORY} class="py-2 text-title">GitHub</a>
						</nav>
						<DocNav />
					</DrawerBody>
				</DrawerContent>
			</Drawer>
		</div>
	</div>
</header>
