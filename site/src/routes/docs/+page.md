Klementine Draw is an infinite canvas for Svelte: the engine of a whiteboard, and the parts to
put one on a page. You draw, write, drag out shapes, connect them with arrows that stay
attached, add pictures and links, group and frame things, turn and snap them, copy and paste,
undo, on as many pages as you like. A board can be kept in the browser and stays in step across
tabs; it saves to a file and to a picture.

Shapes and tools are plugins, also the ones that come with it. So the same engine can be a
whiteboard today and a design tool later, and a kind of shape your app needs is a class and a
Svelte component, not a fork.

## What it is made of

Two layers, imported separately:

| Import                    | What it is                                                                                                  |
| ------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `@klementine/draw`        | the engine: plain TypeScript with no UI framework, so it runs in a browser, in a test and on a server alike |
| `@klementine/draw/svelte` | the Svelte layer: the canvas, the views of the built-in shapes, the toolbar, the panels, `Draw`             |

[How it is built](./concepts/) explains the engine in five ideas.

## Where it stands

Read this before you build on it.

- **Early.** It was built in a few days in November 2026. Much of it is covered by tests of the
  engine (no browser); some of it has only been tried by hand, and a few parts never ran at all.
  [What is built](./features/) says which is which, line by line.
- **Used by one app.** Klementine Tiles, a place for teams and their AI agents to work on
  shared documents, builds its board on it.
- **Not on npm yet.** You get it from GitHub. The engine has no dependencies beyond two small
  MIT libraries. The Svelte layer's controls come from **klementine.ui**, a design system that is
  not public yet, so for now the Svelte layer only builds with a copy of it.
  [Getting started](./start/) shows both ways.
- **No server sync yet.** Tabs of one browser stay in step today. The seam for a server is two
  small interfaces, and nothing on the server side is written.

## tldraw

The architecture follows the ideas of [tldraw](https://tldraw.dev): records in a reactive store,
one class per kind of shape, tools as state machines, plugins as lists of classes. Draw is an
independent implementation, written from scratch for Svelte, and contains no tldraw source code,
icons or assets. tldraw is a trademark of tldraw Inc.; this project is not affiliated with or
endorsed by it. [What is built](./features/) uses tldraw's feature set as the yardstick, because
it is the most complete whiteboard SDK there is.

## Licence

[MIT](https://github.com/simon-lund/svelte-draw/blob/main/LICENSE). Use it, change it, ship it;
keep the copyright notice.
