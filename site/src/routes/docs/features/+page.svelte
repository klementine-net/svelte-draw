<script lang="ts">
	import DocLayout from '#lib/components/doc-layout.svelte';

	let { data } = $props();
</script>

<DocLayout>
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- the repository's own FEATURES.md -->
	{@html data.html}
</DocLayout>
