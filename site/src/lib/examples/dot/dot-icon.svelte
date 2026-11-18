<script lang="ts">
	import Circle from 'phosphor-svelte/lib/Circle';

	// The toolbar's picture of the vote tool: a filled dot, like the ones it puts on the board.
	let props: Record<string, unknown> = $props();
</script>

<Circle {...props} weight="fill" />
