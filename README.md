# Klementine Draw

An infinite canvas for Svelte: draw, drag out shapes, select, move, resize, undo. Shapes and
tools are plugins, so the same engine can be a whiteboard today and a design tool later.

| Folder                | Package                          | What                                                              |
| --------------------- | -------------------------------- | ----------------------------------------------------------------- |
| `packages/draw`       | `@klementine/draw`               | the engine (plain TypeScript) and its Svelte layer: start there   |
| `examples/whiteboard` | `@klementine/example-whiteboard` | a whiteboard with a sticky note written as a plugin, on port 5196 |

```sh
export PATH=/home/simon/.local/share/asdf/installs/nodejs/24.13.0/bin:/home/simon/.local/share/asdf/installs/pnpm/11.0.5/bin:$PATH

pnpm install
pnpm dev      # http://localhost:5196
pnpm check && pnpm test && pnpm lint
```

How it is built, how to write a plugin, the collaboration seam and what is not built yet:
`packages/draw/README.md`.

## klementine.ui

The controls (toolbar, style panel, zoom, hints) are composed from klementine.ui
(`@klementine/ui`), a peer dependency the app brings; the core (`@klementine/draw`) needs no
design system. klementine.ui isn't published yet, so this workspace installs it from a Klementine
monorepo checkout beside this one (`file:../../../klementine/packages/ui`): clone both into the
same folder. After a change in klementine.ui, run `pnpm install --force` here (a plain install
keeps the old copy).
