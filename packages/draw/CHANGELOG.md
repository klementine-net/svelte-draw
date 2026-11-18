# Changelog

## Unreleased

- **Built like a Svelte library.** The package is `dist`: JavaScript, `.svelte` files and
  types, made by svelte-package and checked by publint. The import paths stay the same
  (`@klementine/draw`, `@klementine/draw/svelte`, `@klementine/draw/draw.css`). Installing
  from the folder (`file:`) needs `pnpm --filter @klementine/draw build` first.
- **Breaking: `editText` is an attachment.**
  `use:editText={{ editor, text, onchange }}` becomes
  `{@attach editText({ editor, text: () => text, onchange })}`. `text` is a function now: it is
  read once, as the edit starts, so typing never runs the attachment again.
- A group in the toolbar shows a tool picked from it by key in the same frame.
- The canvas, the note and the text shape do their DOM work in attachments, not effects.
- Browser tests for the Svelte layer: `pnpm test:browser`.
