# Changelog

## Unreleased

- **The project is svelte-draw**, published as `svelte-draw`.
- **Breaking: no controls in the library.** `Draw`, `DrawToolbar`, `StylePanel`, `StyleRow`,
  `ZoomControl`, `PageMenu`, `CanvasMenu` and `defaultLabels` moved to the whiteboard example
  (`examples/whiteboard/src/lib/ui`), to copy. The library needs no design system and no
  Tailwind.
- **Breaking: the canvas's look is its own.** `draw.css` is plain CSS on `--kd-ground`,
  `--kd-ink`, `--kd-line`, `--kd-layer`, `--kd-select` and `--kd-font-sans`, with defaults.
- `Canvas` takes `around`, for what goes around its surface (a context menu's trigger), and
  no longer takes `labels`. `Minimap` takes a `label`.

- **Built like a Svelte library.** The package is `dist`: JavaScript, `.svelte` files and
  types, made by svelte-package and checked by publint. The import paths stay the same
  (`svelte-draw`, `svelte-draw/svelte`, `svelte-draw/draw.css`).
- **Breaking: `editText` is an attachment.**
  `use:editText={{ editor, text, onchange }}` becomes
  `{@attach editText({ editor, text: () => text, onchange })}`. `text` is a function now: it is
  read once, as the edit starts, so typing never runs the attachment again.
- A group in the toolbar shows a tool picked from it by key in the same frame.
- The canvas, the note and the text shape do their DOM work in attachments, not effects.
- Browser tests for the Svelte layer: `pnpm test:browser`.
