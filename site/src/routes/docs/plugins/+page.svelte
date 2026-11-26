<script lang="ts">
	import DocLayout from '#lib/components/doc-layout.svelte';
	import LiveCanvas from '#lib/components/live-canvas.svelte';
	import { dotBoard, plugins } from '#lib/examples/dot/board.ts';

	let { data } = $props();

	const editor = dotBoard();
</script>

<DocLayout>
	<p>
		Every kind of shape and every tool in Draw is a plugin, also the ones it comes with. A plugin is
		a list of classes for the engine and, for the screen, a view and its tool's entry for a toolbar.
		This page builds one: a voting dot, as used in workshops to pick among ideas. It runs below.
	</p>

	<div class="not-prose my-8">
		<LiveCanvas
			{editor}
			{plugins}
			label="Ideas to vote on with dots"
			class="h-80 rounded-md bg-(--canvas-ground) shadow-[0_0_0_1px_var(--line)]"
		/>
		<p class="text-cream-ink3 mt-3 text-label font-normal">
			Pick Vote in the toolbar (or press B) and click a note. Each click is a vote.
		</p>
	</div>

	<h2>The kind and its tool</h2>
	<p>
		A <code>ShapeUtil</code> says what a dot is to the engine: its default props, its box, what
		counts as touching it, and its outline (for hover and selection). It draws nothing. The tool is
		a
		<code>StateNode</code> with one state that waits for a click; a tool with more to do (a drag, a second
		click) has a state for each step.
	</p>
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- highlighted at build time from our own file -->
	{@html data.util}

	<h2>The view</h2>
	<p>
		A Svelte component draws one shape in its own space; the canvas puts it in place, turns it and
		cuts it off at a frame's edge. <code>--kd-color</code> is the shape's colour from its style.
	</p>
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- highlighted at build time from our own file -->
	{@html data.view}

	<h2>The plugin</h2>
	<p>
		The plugin puts them together: the kind, the tool, the key that picks it, the view and the
		toolbar's entry. Give it to the editor and the canvas with the others; a toolbar reads its
		entry.
	</p>
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- highlighted at build time from our own file -->
	{@html data.plugin}
	<pre class="code"><code
			>{`const plugins = [...defaultPlugins, dotPlugin];
const editor = new Editor({ plugins });`}</code
		></pre>

	<h2>More a kind can say</h2>
	<p>
		A <code>ShapeUtil</code> has more hooks, each with a default that does nothing: whether a shape
		holds text (<code>canEdit</code>), which styles it shows, handles of its own (a line's ends),
		where an arrow attached to it stops (<code>edgePoint</code>), whether it is made from pasted
		text or a dropped file (<code>fromText</code>, <code>fromFile</code>), switches in the
		right-click menu (<code>toggles</code>). The
		<a href="../reference/#shape-util">API reference</a> lists them all.
	</p>
</DocLayout>
