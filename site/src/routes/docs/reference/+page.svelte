<script lang="ts">
	import DocLayout from '#lib/components/doc-layout.svelte';
	import type { Group } from './+page.server.ts';

	let { data } = $props();
</script>

{#snippet members(group: Group)}
	<dl class="reference">
		<!-- A class can have a static and an instance member of one name: keyed by place. -->
		{#each group.members as member, at (at)}
			<div>
				<!-- eslint-disable-next-line svelte/no-at-html-tags -- highlighted at build time from the library's source -->
				<dt>{@html member.signature}</dt>
				{#each member.doc as paragraph, i (i)}
					<!-- eslint-disable-next-line svelte/no-at-html-tags -- the library's own doc comments, escaped -->
					<dd>{@html paragraph}</dd>
				{/each}
			</div>
		{/each}
	</dl>
{/snippet}

<DocLayout>
	<p>
		Read from the library's source when this site was built, so it says what the code says. Every
		method is called on the editor (<code>editor.select(ids)</code>); a method's arguments that name
		shapes take their ids.
	</p>

	<h2 id="editor">Editor</h2>
	<p>
		<code>new Editor(&#123; plugins, store?, initialTool?, assets? &#125;)</code>. The editor owns
		the document (its store and history), the view (camera, selection) and the tools. Its values are
		signals: <code>.get()</code> reads and is reactive in Svelte, <code>.peek()</code> reads without
		tracking, <code>.set()</code> writes.
	</p>
	{#each data.editor as group (group.title)}
		<h3>{group.title}</h3>
		{@render members(group)}
	{/each}

	<h2 id="shape-util">ShapeUtil</h2>
	<p>
		The base class of a kind of shape. <code>defaultProps</code>, <code>bounds</code> and
		<code>resize</code> are required; every other hook has a default.
	</p>
	{#each data.shapeUtil as group (group.title)}
		{@render members(group)}
	{/each}

	<h2 id="state-node">StateNode</h2>
	<p>
		The base class of a tool and of each of its states. A state handles only the events it has a
		method for; the rest walk on down the active path.
	</p>
	{#each data.stateNode as group (group.title)}
		{@render members(group)}
	{/each}

	<h2 id="components">Components</h2>
	<p>From <code>@simon-lund/svelte-draw/svelte</code>.</p>
	<dl class="reference">
		{#each data.components as component (component.name)}
			<div>
				<dt id="component-{component.name}"><code>{component.name}</code></dt>
				{#each component.doc as paragraph, i (i)}
					<!-- eslint-disable-next-line svelte/no-at-html-tags -- the library's own doc comments, escaped -->
					<dd>{@html paragraph}</dd>
				{/each}
			</div>
		{/each}
	</dl>
</DocLayout>

<style>
	/* A member: its signature, and under it what it does; members close, sections apart. */
	.reference {
		/* A signature is a line of code, not a block: no recess behind it. */
		--code-background: transparent;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		margin-top: 1rem;
	}
	.reference dt :global(pre.shiki) {
		margin: 0;
		padding: 0;
		background: none;
		font-size: 0.8125rem;
		line-height: 1.5;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	.reference dt :global(code) {
		font-family: var(--font-mono);
		font-size: 0.8125rem;
		background: none;
		padding: 0;
	}
	.reference dd {
		margin: 0.25rem 0 0;
		font-size: 0.9375rem;
		line-height: 1.55;
		color: var(--ink2);
	}
	.reference dd + dd {
		margin-top: 0.5rem;
	}
	.reference dd :global(code) {
		font-family: var(--font-mono);
		font-size: 0.8125em;
		color: var(--ink);
	}
</style>
