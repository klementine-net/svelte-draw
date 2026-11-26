<script lang="ts">
	import Play from 'phosphor-svelte/lib/Play';
	import type { Editor } from '@simon-lund/svelte-draw';

	/**
	 * ScriptRunner: an example's code, and a button that runs exactly that code on the page's
	 * canvas. What it answers (or the error it throws) shows beside the button.
	 */
	let {
		editor,
		code,
		run,
		label = 'Run'
	}: {
		editor: Editor;
		/** The example's source, highlighted. */
		code: string;
		run: (editor: Editor) => string | void;
		label?: string;
	} = $props();

	let answer = $state('');
</script>

<div class="my-6">
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- highlighted at build time from our own file -->
	{@html code}
	<div class="-mt-2 flex items-center gap-3">
		<button
			type="button"
			class="button"
			data-kind="key"
			onclick={() => {
				try {
					answer = run(editor) ?? '';
				} catch (error) {
					answer = `It stopped: ${(error as Error).message}`;
				}
			}}
		>
			<Play aria-hidden="true" weight="fill" />{label}
		</button>
		<p class="text-label font-normal text-ink2" aria-live="polite">{answer}</p>
	</div>
</div>
