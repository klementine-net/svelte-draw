<script lang="ts">
	import { page } from '$app/state';
	import { href } from '#lib/nav.ts';

	/* A page that does not exist, or one that failed: says which, and where to go instead. */
	const missing = $derived(page.status === 404);
</script>

<svelte:head
	><title>{missing ? 'Not found' : 'Something went wrong'} · svelte-draw</title></svelte:head
>

<main class="mx-auto max-w-(--site-max) px-(--site-margin) py-24 md:px-8">
	<h1 class="text-display font-semibold tracking-[-0.035em]">
		{missing ? 'There is no page here.' : 'This page could not be shown.'}
	</h1>
	<p class="text-cream-ink2 mt-4 max-w-[36rem] leading-[1.625]">
		{missing
			? 'The address may have changed. The documentation starts with the introduction.'
			: 'Try loading it again. If it keeps failing, the documentation starts with the introduction.'}
	</p>
	<p class="mt-8 flex gap-6">
		<a href={href('/docs/')} class="font-semibold underline underline-offset-4">Introduction</a>
		<a href={href('/')} class="font-semibold underline underline-offset-4">Home</a>
	</p>
</main>
