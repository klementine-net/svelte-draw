<script>
	import EarlyNotice from '#lib/components/early-notice.svelte';
</script>

<EarlyNotice />

## Install

```sh
npm install svelte-draw
```

svelte-draw needs Svelte 5.57 or newer and nothing else: no CSS framework and no component kit.
The engine alone (`svelte-draw` without `/svelte`) is plain TypeScript and runs in
Node as well as in a browser.

## A canvas on a page

The canvas shows an editor's shapes and turns the pointer, the wheel and the keys into the
editor's events. It fills its parent, so give the parent a size.

```svelte
<script lang="ts">
	import { Editor } from 'svelte-draw';
	import { Canvas, defaultPlugins } from 'svelte-draw/svelte';
	import 'svelte-draw/draw.css';

	const editor = new Editor({ plugins: defaultPlugins });
</script>

<div style="height: 100dvh">
	<Canvas {editor} plugins={defaultPlugins} label="Whiteboard" />
</div>
```

That is a whiteboard already, worked by its keys: `D` draws, `R` drags out a rectangle, `T`
writes, `N` sticks a note, `V` goes back to selecting. Undo, copy and paste, the wheel and a
pinch work as you expect.

Hand-drawn text wants a handwriting font. Load one and name it in `--kd-font-hand`; the demo
and this site use Caveat (`@fontsource/caveat`).

## Controls

The library brings no toolbar, panels or menus. They belong to your app and should look like
it. There are two ways to get them.

**Build your own on the editor.** Everything a control does is a call on the editor, and every
plugin lists its tools with a name, an icon and a key. A toolbar is a loop:

```svelte
<Canvas {editor} plugins={defaultPlugins} label="Whiteboard">
	<div class="tools">
		{#each defaultPlugins.flatMap((plugin) => plugin.toolbar ?? []) as item (item.tool)}
			<button
				aria-label={item.label}
				aria-pressed={editor.tool === item.tool}
				onclick={() => editor.setTool(item.tool)}
			>
				<item.icon />
			</button>
		{/each}
	</div>
</Canvas>
```

What sits inside `Canvas` lies above the surface and does not send it events.
[Driving the editor](../scripting/) lists what else a control can call: styles, undo, zoom,
pages, arranging.

**Copy the example's.** The
[whiteboard example](https://github.com/simon-lund/svelte-draw/tree/main/examples/whiteboard/src/lib/ui)
has a full set: a toolbar with grouped tools, a style panel, a page menu, a zoom control, a
right-click menu, and `Whiteboard`, which puts them around the canvas and keeps the board in
the browser. The [demo](../../demo/) is that example. They are Svelte components on
[bits-ui](https://bits-ui.com) (menus, hints and bars that work with a keyboard) and one plain
stylesheet whose colours are a handful of properties. Copy the folder and make it yours.
[Look and controls](../styling/) shows the seams.

## Keep the board

A board lasts as long as the page. `persist` keeps it in the browser (IndexedDB) under a name
and in step with every other tab that shows the same name.

```svelte
<script lang="ts">
	import { broadcastChannel, Editor, indexedDbStorage, persist } from 'svelte-draw';
	import { Canvas, defaultPlugins } from 'svelte-draw/svelte';

	const editor = new Editor({ plugins: defaultPlugins });

	$effect(() => {
		const kept = persist(editor, {
			storage: indexedDbStorage('my-board'),
			channel: broadcastChannel('my-board'),
			// A first picture for a board that was never saved.
			seed: (editor) => editor.createShape({ kind: 'note', x: 0, y: 0, props: { text: 'Hello' } })
		});
		return () => void kept.then((stop) => stop());
	});
</script>

<Canvas {editor} plugins={defaultPlugins} label="Whiteboard" />
```

[Saving and sharing](../saving/) has the rest: your own storage, files, pictures.

## What `Canvas` takes

| Prop       | What it does                                                                           |
| ---------- | -------------------------------------------------------------------------------------- |
| `editor`   | the editor it shows and works on                                                       |
| `plugins`  | the kinds of shapes and their views; the same list the editor was made with            |
| `label`    | the canvas's name for a screen reader                                                  |
| `scheme`   | `light` (the default), `dark`, or `auto` to follow the system                          |
| `children` | what lies above the surface: your controls                                             |
| `around`   | what goes around the surface, a context menu's trigger for one (see Look and controls) |

The editor has the rest: `editor.setReadOnly(true)` shows a board without letting it be
changed, and `Minimap` and `deepLink` (the page and the view in the address) come from
`svelte-draw/svelte`.
