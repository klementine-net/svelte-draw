# Agents: svelte-draw

Read README.md first (the two layers, the five ideas, what is not built).

- **The core never imports Svelte** (`src/lib/core.ts`, `core/`, `shapes/*.ts`, `tools/*.ts`):
  it must run under `node --test` and on a server. Rendering lives in `src/lib/svelte`.
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
  the build rewrites them to `.js`. Nothing reaches into `dist` by path.
- **Two entries.** `src/lib/core.ts` is the engine alone (`@klementine/svelte-draw/core`).
  `src/lib/index.ts` is the main one (`@klementine/svelte-draw`): the Svelte layer, plus the
  whole engine by `export * from './core.ts'`. Anything public is exported from one of them.
  Inside the library, import the engine from `core.ts`, never from `index.ts`. A built-in
  plugin that has a view must be exported from `index.ts` by name, or the engine's plugin of
  the same name shows through the star; `tests/browser/entries.test.ts` checks that.
- Checks: `pnpm --filter @klementine/svelte-draw check`, `test`, `lint`.
