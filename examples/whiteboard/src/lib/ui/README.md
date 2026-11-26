# Controls for svelte-draw

A toolbar, a style panel, a page menu, a zoom control and a right-click menu for a
[svelte-draw](https://docs.simon-lund.com/svelte-draw/) canvas, and `Whiteboard`, which puts
them around the canvas and keeps the board in the browser. The library brings no controls of its
own: copy this folder into your app and change it.

It needs `bits-ui` (menus, hints and bars that work with a keyboard) and `phosphor-svelte`
(icons). The look is one plain stylesheet, `ui.css`: no CSS framework.

```svelte
<script lang="ts">
	import 'svelte-draw/draw.css';
	import './ui/ui.css';
	import { Whiteboard } from './ui';
</script>

<div style="height: 100dvh">
	<Whiteboard persistenceKey="my-board" minimap />
</div>
```

| File                  | What                                                                      |
| --------------------- | ------------------------------------------------------------------------- |
| `whiteboard.svelte`   | the canvas with every control in its corner, and the phone arrangement    |
| `draw-toolbar.svelte` | the tools of the plugins, grouped, then undo and redo                     |
| `style-panel.svelte`  | the look of what is selected: colour, fill, size, line, type, opacity     |
| `page-menu.svelte`    | the pages, and saving to a file or a picture                              |
| `zoom-control.svelte` | out, the zoom in percent, in, show everything                             |
| `canvas-menu.svelte`  | what the right-click menu offers for the selection                        |
| `hint.svelte`         | an icon's name and key, beside it                                         |
| `board.ts`            | the scheme for menus and hints, the keys back to the canvas, a long press |
| `labels.ts`           | every word the controls say, to translate                                 |
| `ui.css`              | the look: classes `wb-*`, colours as properties on `.wb`                  |

## Make it yours

- **Typeface:** the controls take the page's, so set one on `body`.
- **Colours:** set the `--wb-*` properties on `.wb` (a bar, a panel, ink, the picked tool).
  Each has a light and a dark value.
- **Light and dark:** `<Whiteboard scheme="dark">`, or `auto` (the default) to follow the
  system. Menus and hints are drawn outside the board, on the page; they get the scheme through
  `board.ts`.
- **Words:** pass `labels` (start from `defaultLabels`). A plugin's tool names travel with the
  plugin.
- **One control alone:** each takes the `editor` and stands on its own inside `Canvas`:
  `<Canvas …><DrawToolbar {editor} {plugins} /></Canvas>`.
