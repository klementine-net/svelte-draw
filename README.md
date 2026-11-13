# Klementine Draw

An infinite canvas for Svelte: draw, write, drag out shapes, connect them with arrows, add
pictures and links, group, frame, turn, snap, copy and paste, undo, on several pages. It keeps
the document in the browser, keeps tabs in step and saves pictures and files. Shapes and tools
are plugins, so the same engine can be a whiteboard today and a design tool later.

**Try it:** <https://simon-lund.github.io/svelte-draw/demo/>. The board is kept in your own
browser; nothing is sent anywhere.

What is built and what is not: [FEATURES.md](FEATURES.md).

## Status

Early. It was built in a few days, no app uses it yet, and much of it is tested in the engine
but not by hand ([FEATURES.md](FEATURES.md) says which parts). It is not on npm.

| Folder                | Package                          | What                                                            |
| --------------------- | -------------------------------- | --------------------------------------------------------------- |
| `packages/draw`       | `@klementine/draw`               | the engine (plain TypeScript) and its Svelte layer: start there |
| `examples/whiteboard` | `@klementine/example-whiteboard` | the demo: a whiteboard that is kept in the browser              |

How it is built, how to write a plugin and the collaboration seam: `packages/draw/README.md`.

## Run it

Node 24 and pnpm 11.

```sh
pnpm install
pnpm dev      # http://localhost:5196
pnpm check && pnpm test && pnpm lint
```

The controls (toolbar, style panel, menus, hints) are composed from klementine.ui
(`@klementine/ui`), a peer dependency the app brings; the core (`@klementine/draw`) needs no
design system. **klementine.ui is not public yet**, so for now the demo and the Svelte layer
only build with a checkout of it beside this repository (`../klementine/packages/ui`); the
engine and its tests (`pnpm --filter @klementine/draw test`) need nothing else. After a change
in klementine.ui, run `pnpm install --force` here (a plain install keeps the old copy).

`scripts/publish-demo.sh` builds the demo and publishes it to GitHub Pages.

## Relation to tldraw

The architecture is modelled on the ideas of [tldraw](https://tldraw.dev): records in a
reactive store, one class per kind of shape, tools as state machines, plugins as lists of
classes. Klementine Draw is an independent implementation, written from scratch for Svelte. It
contains no tldraw source code, icons or assets and depends on no tldraw package.

tldraw is a trademark of tldraw Inc. This project is not affiliated with, sponsored by or
endorsed by tldraw.

## Licence

[MIT](LICENSE). Use it, change it, ship it; keep the copyright notice.
