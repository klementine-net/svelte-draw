# Agents: svelte-draw

Read README.md first (the two layers, the five ideas, what is not built).

- **The core never imports Svelte** (`src/lib/core`, `shapes/*.ts`, `tools/*.ts`): it must run
  under `node --test` and on a server. Rendering lives in `src/lib/svelte`.
- **Erasable TypeScript only** in the core (no enums, no parameter properties): the tests run
  the `.ts` files directly with Node. Import with the `.ts` extension.
- **Every document change goes through the store**, and a tool calls `editor.history.mark()`
  before an interaction and `bail()` on cancel. A new interaction is a new state, not a flag.
- **A new shape or tool is a plugin**, also inside this package: a `ShapeUtil`, a `StateNode`,
  a view, a toolbar entry. Do not special-case a kind in the editor or the canvas.
- **Where new code goes** (README has the map): a new editor method is a function in the
  fitting `core/editor/*.ts` file that takes `editor`, plus a one-line method with the JSDoc on
  the `Editor` class. Those functions call `editor.x()`, never each other's files, and import
  the `Editor` type with `import type` (a value import would be a cycle). A new state of the
  select tool is a file in `tools/select/`. Code that needs a browser but not Svelte goes in
  `browser/`. A test goes in the file of its area in `tests/`.
- **No tldraw code.** tldraw's source may be read to learn how it is designed; its editor,
  default shapes, sync and assets are under a licence that forbids production use. Write from
  the idea, never from the file, and never bring in its icons, assets or packages. Its name is
  a trademark: it appears only where the two are compared or the lineage is credited.
- The canvas's classes are `kd-*` in `src/lib/draw.css`: plain CSS, on the package's own
  properties on `.kd-root` (`--kd-ground`, `--kd-ink`, …) with defaults. No Tailwind class and
  no design system in this package. Shape colours are named (`ink`, `red`, …); no orange.
- **No controls here.** Only what is the canvas's own is written in this package: shapes,
  selection, the minimap. A toolbar, a panel or a menu goes to `examples/whiteboard/src/lib/ui`;
  what it needs from the canvas is a prop or a snippet (`around`), never an import of a
  component library.
- **Shipped built, like any Svelte library**: `pnpm build` (svelte-package, then publint)
  writes `dist`, and the demo, the site and every app use that. Source imports keep `.ts`;
  the build rewrites them to `.js`. Anything public is exported from `src/lib/index.ts` or
  `src/lib/svelte/index.ts`; nothing reaches into `dist` by path.
- Checks: `pnpm --filter svelte-draw check`, `test`, `lint`.
