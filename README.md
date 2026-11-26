# svelte-draw

An infinite canvas for Svelte: draw, write, drag out shapes, connect them with arrows, add
pictures and links, group, frame, turn, snap, copy and paste, undo, on several pages. It keeps
the document in the browser, keeps tabs in step and saves pictures and files. Shapes and tools
are plugins, so the same engine can be a whiteboard today and a design tool later.

> [!WARNING]
> **Early development.** Draw works, and it is young. Its API will change between releases
> without notice, and parts of it are little tested. Pin the version you install, and check
> [what is built](FEATURES.md) before you rely on a part of it.

**Documentation:** <https://docs.simon-lund.com/svelte-draw/>, with a board to draw on and
examples that run. **Demo:** <https://docs.simon-lund.com/svelte-draw/demo/>. Both keep what
you draw in your own browser; nothing is sent anywhere.

## Install

```sh
npm install @simon-lund/svelte-draw @klementine/ui
```

```svelte
<script lang="ts">
	import { Draw } from '@simon-lund/svelte-draw/svelte';
</script>

<div class="h-dvh"><Draw persistenceKey="my-board" /></div>
```

```css
@import 'tailwindcss';
@import '@klementine/ui/theme.css';
@import '@simon-lund/svelte-draw/draw.css';
```

One component is the whole whiteboard, and `persistenceKey` keeps the board in the browser.
Draw needs Svelte 5.57 or newer and Tailwind CSS 4; its toolbar, panels and menus are parts of
klementine.ui (`@klementine/ui`). The engine alone (`@simon-lund/svelte-draw` without `/svelte`) is
plain TypeScript and needs none of that.
[Getting started](https://docs.simon-lund.com/svelte-draw/docs/start/) has the rest, and
[FEATURES.md](FEATURES.md) lists what is built and what is not.

## Built with AI

Draw's code, tests and documentation are written by AI coding agents (Claude Code), directed
by the project's maintainers. How each part was checked, by which tests or by trying it in a
browser, is listed at the end of [FEATURES.md](FEATURES.md).

## This repository

| Folder                | Package                          | What                                                            |
| --------------------- | -------------------------------- | --------------------------------------------------------------- |
| `packages/draw`       | `@simon-lund/svelte-draw`        | the engine (plain TypeScript) and its Svelte layer: start there |
| `examples/whiteboard` | `svelte-draw-example-whiteboard` | the demo: a whiteboard that is kept in the browser              |
| `site`                | `svelte-draw-site`               | the documentation website, with live canvases                   |

How it is built, how to write a plugin and the collaboration seam: `packages/draw/README.md`.

## Develop

Node 24 and pnpm 11.

```sh
pnpm install
pnpm dev      # the demo, on http://localhost:5196
pnpm dev:site # the documentation site, on http://localhost:5197
pnpm check && pnpm test && pnpm lint
pnpm test:browser  # the Svelte layer, in the Chrome installed on the machine
```

The demo and the site use the library as it ships: built, in `packages/draw/dist`
(`pnpm --filter @simon-lund/svelte-draw build`). `pnpm dev`, `check` and `lint` build it first, and
`pnpm dev` rebuilds it on every change.

The workspace takes klementine.ui from a checkout beside this repository
(`../klementine/packages/ui`), which the demo, the site and the Svelte layer need; the engine
and its tests (`pnpm --filter @simon-lund/svelte-draw test`) need nothing else. After a change in
klementine.ui, run `pnpm install --force` here (a plain install keeps the old copy).

`scripts/publish-site.sh` builds the documentation site (`site/`, its design in
`site/DESIGN.md`) and the demo, and publishes both to GitHub Pages.

## Credits

Draw's architecture is inspired by [tldraw](https://tldraw.dev): records in a reactive store,
one class per kind of shape, tools as state machines. Draw is an independent project, written
from scratch for Svelte; it contains no tldraw code and is not affiliated with tldraw Inc.

Ink strokes are drawn with [perfect-freehand](https://github.com/steveruizok/perfect-freehand),
the stacking order comes from
[fractional-indexing](https://github.com/rocicorp/fractional-indexing), and the icons are
[Phosphor](https://phosphoricons.com).

## Licence

[MIT](LICENSE). Use it, change it, ship it; keep the copyright notice.
