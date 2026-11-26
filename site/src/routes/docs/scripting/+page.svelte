<script lang="ts">
	import {
		defaultPlugins,
		Editor,
		geoPlugin,
		handPlugin,
		linePlugin,
		selectPlugin
	} from '@klementine/svelte-draw';
	import DocLayout from '#lib/components/doc-layout.svelte';
	import LiveCanvas from '#lib/components/live-canvas.svelte';
	import ScriptRunner from '#lib/components/script-runner.svelte';
	import add from '#lib/examples/scripts/add.ts';
	import arrange from '#lib/examples/scripts/arrange.ts';
	import move from '#lib/examples/scripts/move.ts';
	import read from '#lib/examples/scripts/read.ts';
	import undo from '#lib/examples/scripts/undo.ts';

	let { data } = $props();

	// An empty board for the examples to work on; its toolbar has only what they need.
	const editor = new Editor({ plugins: defaultPlugins });
	const tools = [selectPlugin, handPlugin, geoPlugin, linePlugin];
</script>

<DocLayout>
	<p>
		The editor has a method for everything a person does on the canvas, and the tools use the same
		methods. So what you can do with the mouse, a script can do too: build a board from your data,
		react to a button outside the canvas, or test your own plugin without a browser.
	</p>

	<div
		class="not-prose sticky top-[calc(var(--site-header)+0.5rem)] z-10 my-8 md:top-[calc(var(--site-header)+1rem)]"
	>
		<LiveCanvas
			{editor}
			plugins={tools}
			fit={false}
			label="A board for the examples on this page"
			class="h-64 rounded-md bg-(--paper) shadow-[0_0_0_1px_var(--line)] md:h-80"
		/>
	</div>

	<h2>Make shapes</h2>
	<p>
		<code>createShape</code> takes a kind, a place and the props that differ from the kind's defaults.
		A line's ends can be tied to shapes by their ids. Run it, and the board above fills.
	</p>
	<ScriptRunner {editor} code={data.code.add} run={add} />

	<h2>Change them</h2>
	<p>
		<code>updateShape</code> changes a record; nothing else needs to know. The arrow follows, because
		an attached end is worked out from the shape each time it is drawn.
	</p>
	<ScriptRunner {editor} code={data.code.move} run={move} />

	<h2>Work on the selection</h2>
	<p>
		What the right-click menu offers is a method too: align, space evenly, flip, group, lock, bring
		to front.
	</p>
	<ScriptRunner {editor} code={data.code.arrange} run={arrange} />

	<h2>Read the document</h2>
	<p>
		The whole board is a list of plain records. This is what is saved, sent to other tabs and
		written to a file.
	</p>
	<ScriptRunner {editor} code={data.code.read} run={read} />

	<h2>Undo</h2>
	<p>Each example above is one step, because it marks the history before it starts.</p>
	<ScriptRunner {editor} code={data.code.undo} run={undo} />

	<h2>Listen</h2>
	<p>
		<code>editor.store.listen</code> calls you after every change with the diff and where it came from.
		Saving, the history and the channel between tabs are all built this way.
	</p>
	<pre class="code"><code
			>{`const stop = editor.store.listen((diff, source) => {
	if (source === 'user') send(diff);
});`}</code
		></pre>
	<h2>Without Svelte</h2>
	<p>
		A script under Node or a server has no canvas. It takes the editor from
		<code>@klementine/svelte-draw/core</code>, the engine alone, with <code>corePlugins</code> in
		place of <code>defaultPlugins</code>: the same kinds and tools, without their views.
	</p>
	<pre class="code"><code
			>{`import { corePlugins, Editor } from '@klementine/svelte-draw/core';

const editor = new Editor({ plugins: corePlugins });
editor.createShape({ kind: 'note', x: 0, y: 0, props: { text: 'Made on a server' } });`}</code
		></pre>
	<p>
		The methods are listed, with what each does, in the <a href="../reference/">API reference</a>.
	</p>
</DocLayout>
