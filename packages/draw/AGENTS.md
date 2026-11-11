# Agents: @klementine/draw

Read README.md first (the two layers, the five ideas, what is not built).

- **The core never imports Svelte** (`src/lib/core`, `shapes/*.ts`, `tools/*.ts`): it must run
  under `node --test` and on a server. Rendering lives in `src/lib/svelte`.
- **Erasable TypeScript only** in the core (no enums, no parameter properties): the tests run
  the `.ts` files directly with Node. Import with the `.ts` extension.
- **Every document change goes through the store**, and a tool calls `editor.history.mark()`
  before an interaction and `bail()` on cancel. A new interaction is a new state, not a flag.
- **A new shape or tool is a plugin**, also inside this package: a `ShapeUtil`, a `StateNode`,
  a view, a toolbar entry. Do not special-case a kind in the editor or the canvas.
- **No tldraw code.** `~/workspaces/references/tldraw` is for reading how it is designed; its
  editor, default shapes, sync and assets are under a licence that forbids production use.
  Write from the idea, never from the file.
- The canvas's classes are `kd-*` in `src/draw.css` on the theme's tokens; controls come from
  `@klementine/ui`. Shape colours are named (`ink`, `red`, …); no orange.
- **UI comes from klementine.ui**: before writing a control, look in
  `../klementine/packages/ui/src/lib/registry/ui`; only what is the canvas's own (shapes,
  selection, the colour dots) is written here.
- Checks: `pnpm --filter @klementine/draw check`, `test`, `lint`.
