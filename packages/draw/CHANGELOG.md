# Changelog

## 0.1.0 (2026-11-26)

The first version on npm: `npm install @klementine/svelte-draw`. The entries below are what
changed on the way to it.

- **The project is svelte-draw**, published as `@klementine/svelte-draw`.
- **Breaking: one import.** `@klementine/svelte-draw` is the Svelte layer with the whole engine
  in it: `Canvas`, the built-in plugins with their views, `Editor` and the rest. The engine
  alone, for where there is no Svelte, is `@klementine/svelte-draw/core`. The `/svelte` entry is
  gone.
- **Breaking: no controls in the library.** `Draw`, `DrawToolbar`, `StylePanel`, `StyleRow`,
  `ZoomControl`, `PageMenu`, `CanvasMenu` and `defaultLabels` moved to the whiteboard example
  (`examples/whiteboard/src/lib/ui`), to copy. The library needs no design system and no
  Tailwind.
- **Breaking: the canvas's look is its own.** `draw.css` is plain CSS on `--kd-ground`,
  `--kd-ink`, `--kd-line`, `--kd-layer`, `--kd-select` and `--kd-font-sans`, with defaults.
- `Canvas` takes `around`, for what goes around its surface (a context menu's trigger), and
  no longer takes `labels`. `Minimap` takes a `label`.

- **Built like a Svelte library.** The package is `dist`: JavaScript, `.svelte` files and
  types, made by svelte-package and checked by publint.
- **Breaking: `editText` is an attachment.**
  `use:editText={{ editor, text, onchange }}` becomes
  `{@attach editText({ editor, text: () => text, onchange })}`. `text` is a function now: it is
  read once, as the edit starts, so typing never runs the attachment again.
- A group in the toolbar shows a tool picked from it by key in the same frame.
- The canvas, the note and the text shape do their DOM work in attachments, not effects.
- Browser tests for the Svelte layer: `pnpm test:browser`.
