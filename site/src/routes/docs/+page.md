<script>
	import EarlyNotice from '#lib/components/early-notice.svelte';
</script>

Klementine Draw is an infinite canvas for Svelte: the engine of a whiteboard, and the parts to
put one on a page. You draw, write, drag out shapes, connect them with arrows that stay
attached, add pictures and links, group and frame things, turn and snap them, copy and paste,
undo, on as many pages as you like. A board can be kept in the browser and stays in step across
tabs; it saves to a file and to a picture.

Shapes and tools are plugins, also the ones that come with it. So the same engine can be a
whiteboard today and a design tool later, and a kind of shape your app needs is a class and a
Svelte component, not a fork.

<EarlyNotice />

## What it is made of

Two layers, imported separately:

| Import                    | What it is                                                                                                  |
| ------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `@klementine/draw`        | the engine: plain TypeScript with no UI framework, so it runs in a browser, in a test and on a server alike |
| `@klementine/draw/svelte` | the Svelte layer: the canvas, the views of the built-in shapes, the toolbar, the panels, `Draw`             |

[How it is built](./concepts/) explains the engine in five ideas.

## Where it stands

- **Tested where it counts, not everywhere.** The engine has its own tests, which need no
  browser, and the Svelte layer is tested in Chrome. Some parts have only been tried in a
  browser, and a few never ran at all. [What is built](./features/) says which is which, line by
  line.
- **Built with AI.** The code, the tests and these pages are written by AI coding agents
  (Claude Code), directed by the project's maintainers.
- **Two packages.** The engine has no dependencies beyond two small libraries. The Svelte
  layer's toolbar, panels and menus come from **klementine.ui**, a design system for Svelte
  that you install beside it. [Getting started](./start/) shows how.
- **No server sync yet.** Tabs of one browser stay in step today. The seam for a server is two
  small interfaces, and nothing on the server side is written.

## Credits

Draw's architecture is inspired by [tldraw](https://tldraw.dev): records in a reactive store,
one class per kind of shape, tools as state machines. Draw is an independent project, written
from scratch for Svelte; it contains no tldraw code and is not affiliated with tldraw Inc.

Ink strokes are drawn with [perfect-freehand](https://github.com/steveruizok/perfect-freehand),
the stacking order comes from
[fractional-indexing](https://github.com/rocicorp/fractional-indexing), and the icons are
[Phosphor](https://phosphoricons.com).

## Licence

[MIT](https://github.com/klementine-net/svelte-draw/blob/main/LICENSE). Use it, change it, ship it;
keep the copyright notice.
