<script lang="ts">
	import { here, href, sections } from '#lib/nav.ts';

	/**
	 * DocNav: the documentation's pages, grouped, in reading order. The page you are on is marked
	 * for the eye (ink, weight) and for a screen reader (aria-current). `onnavigate` lets the phone's
	 * menu close when a page is chosen.
	 */
	let { onnavigate }: { onnavigate?: () => void } = $props();

	const current = $derived(here());
</script>

<nav aria-label="Documentation" class="flex flex-col gap-8">
	{#each sections as section (section.title)}
		<div>
			<h2 class="text-cream-ink3 mb-2 text-label">{section.title}</h2>
			<ul class="flex flex-col gap-0.5">
				{#each section.pages as item (item.path)}
					<li>
						<a
							href={href(item.path)}
							aria-current={item.path === current ? 'page' : undefined}
							onclick={() => onnavigate?.()}
							class="text-cream-ink2 -mx-2 block rounded-sm px-2 py-1.5 text-[0.9375rem] leading-5 hover:text-cream-ink aria-[current=page]:bg-cream-recess aria-[current=page]:font-semibold aria-[current=page]:text-cream-ink"
						>
							{item.title}
						</a>
					</li>
				{/each}
			</ul>
		</div>
	{/each}
</nav>
