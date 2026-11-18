## Get the code

Draw is not on npm yet. Clone the repository; it is a pnpm workspace with the library in
`packages/draw`, the demo in `examples/whiteboard` and this site in `site`.

```sh
git clone https://github.com/klementine-net/svelte-draw.git
cd svelte-draw
pnpm install
pnpm dev        # the demo, on http://localhost:5196
pnpm test       # the engine's tests, no browser needed
```

You need Node 24 and pnpm 11. The demo uses the library as it ships, built into
`packages/draw/dist`: `pnpm dev` builds it first and rebuilds it as you change it.

**The Svelte layer needs klementine.ui.** The toolbar, the panels and the menus are built from
klementine.ui, a Svelte design system that is not public yet. Until it is, the demo and the
Svelte layer only build with a copy of it beside the repository (`../klementine/packages/ui`).
The engine needs nothing of it: you can build your own controls on the engine today, and the
tests run without it.

## A whiteboard on a page

One component is the whole whiteboard: the canvas, the toolbar, the style panel, the page menu
and the zoom control. It fills its parent, so give the parent a size.

```svelte
<script lang="ts">
	import { Draw } from '@klementine/draw/svelte';
</script>

<div class="h-dvh">
	<Draw />
</div>
```

The styles come after the design system's theme:

```css
@import 'tailwindcss';
@import '@klementine/ui/theme.css';
@import '@klementine/draw/draw.css';
```

Hand-drawn text wants a handwriting font. Load one and name it in `--kd-font-hand`; the demo
and this site use Caveat (`@fontsource/caveat`).

## Keep the board

Without a name the board lasts as long as the page. Give it one and it is kept in the browser
(IndexedDB) and stays in step with every other tab that shows the same name.

```svelte
<Draw persistenceKey="my-board" />
```

A board that was never saved can start with a first picture:

```svelte
<script lang="ts">
	import type { Editor } from '@klementine/draw';
	import { Draw } from '@klementine/draw/svelte';

	function seed(editor: Editor) {
		editor.createShape({ kind: 'note', x: 0, y: 0, props: { text: 'Hello' } });
	}
</script>

<Draw persistenceKey="my-board" {seed} />
```

## Hold the editor yourself

`Draw` makes an editor of its own. Make it yourself when you want to drive the board from code,
save it somewhere else or listen to what changes. [Driving the editor](../scripting/) shows
what it can do.

```svelte
<script lang="ts">
	import { Editor } from '@klementine/draw';
	import { defaultPlugins, Draw } from '@klementine/draw/svelte';

	const editor = new Editor({ plugins: defaultPlugins });
</script>

<Draw {editor} />
```

## What else `Draw` takes

| Prop             | What it does                                                                     |
| ---------------- | -------------------------------------------------------------------------------- |
| `plugins`        | the kinds of shapes and the tools; `defaultPlugins` by default                   |
| `editor`         | an editor you made; otherwise `Draw` makes one with `plugins`                    |
| `persistenceKey` | keeps the board in the browser under this name and in step across tabs           |
| `seed`           | fills a board that was never saved                                               |
| `user`           | the name and colour other tabs see on this user's pointer                        |
| `readOnly`       | the view can be moved, nothing can be changed                                    |
| `focus`          | nothing but the canvas: no toolbar, panels or menus                              |
| `minimap`        | a small map of the page in the bottom right corner                               |
| `deepLinks`      | keeps the page and the view in the address, so a copied link opens where it was  |
| `labels`         | the words of the controls, to translate them (see [Look and words](../styling/)) |
