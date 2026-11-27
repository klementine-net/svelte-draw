<script>
	import EarlyNotice from '#lib/components/early-notice.svelte';
</script>

svelte-draw is an infinite canvas for Svelte: the engine of a whiteboard, and the parts to
put one on a page. You draw, write, drag out shapes, connect them with arrows that stay
attached, add pictures and links, group and frame things, turn and snap them, copy and paste,
undo, on as many pages as you like. A board can be kept in the browser and stays in step across
tabs; it saves to a file and to a picture.

Shapes and tools are plugins, also the ones that come with it. So the same engine can be a
whiteboard today and a design tool later, and a kind of shape your app needs is a class and a
Svelte component, not a fork.

<EarlyNotice />

## What it is made of

Two layers. A Svelte app imports one thing, and the engine also comes on its own:

| Import                         | What it is                                                                                                    |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `@klementine/svelte-draw`      | everything for a Svelte app: the canvas, the views of the built-in shapes, the minimap, and the whole engine  |
| `@klementine/svelte-draw/core` | the engine alone: plain TypeScript with no UI framework, so it runs in a test and on a server as in a browser |

[How it is built](./concepts/) explains the engine in five ideas.

## Where it stands

- **Tested where it counts, not everywhere.** The engine has its own tests, which need no
  browser, and the Svelte layer is tested in Chrome. Some parts have only been tried in a
  browser, and a few never ran at all. [What is built](./features/) says which is which, line by
  line.
- **Built with AI.** The code, the tests and these pages are written by AI coding agents
  (Claude Code), directed by the project's maintainers. The pages are not finished: not all of
  them have been reviewed by a person yet.
- **The UI is yours.** The library provides the engine and the canvas, in plain CSS, with
  three small dependencies. The toolbar, the panels and the menus you build in your own design:
  on the editor, or by adapting the ones in the whiteboard example.
  [Getting started](./start/) shows both.
- **No server sync yet.** A board open in several tabs of one browser updates in all of them.
  Syncing through a server is prepared by two small interfaces, and nothing on the server side is
  written.

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
