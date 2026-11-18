# The Draw website: design

How the documentation site at `docs.klementine.net/svelte-draw/` is decided. Written before
the first line of code, after the manifest's four steps; change it here first, then the code.

## The moment

A Svelte developer arrives from GitHub or a link and decides whether to try Draw. In three
seconds they need to know what it is, see that it works (they can draw on it right there),
and find where to start. Later they come back to look something up while building.

## The organising idea

**Paper and ink.** The site is the quiet page the library draws on; the only colour on it is
what someone draws on a live canvas.

## Grid, type, colour

- **Rhythm:** a 4px base, spaced in steps of 8.
- **Regular** (tablets and up): a 224px sidebar, 48px gap, a text column of at most 680px
  (about 70 characters), the whole held left within 1180px. The canvas on the home page spans
  the sidebar and the column.
- **Compact** (phones): one column, 20px side margins.
- **Type:** Instrument Sans for text, JetBrains Mono for code, both self-hosted (no request to
  Google). Sizes are klementine.ui's: display 30/36 for a page's title, headline 22/28 for a
  section, title 17/23 for a subsection, body 16/24, label 13/16 for navigation and captions.
  Two weights, 400 and 600.
- **Colour:** the theme's paper (`--canvas-ground`) and ink (`--cream-ink`, quieter
  `--cream-ink2`). No accent: a link is ink and underlined, the one button that matters is
  filled with ink. Colour appears only in drawings on a live canvas. Light and dark follow the
  system.

## Elements and their jobs

| Element     | Its job, which nothing else does                                            |
| ----------- | --------------------------------------------------------------------------- |
| Header      | the name (home), and the three places: Docs, Demo, GitHub                   |
| Sidebar     | the pages, in reading order; where you are                                  |
| Page        | a title, one sentence on what the page is for, then the sections            |
| Live canvas | proves it works; on the home page you draw, in the docs the code shown runs |
| Page footer | what comes next, and where to change this page                              |

## Left out on purpose

Search (nine pages fit in the sidebar), a contents list per page (pages are short), a version
picker (one version), cards, badges, an illustration, a newsletter, a cookie banner (nothing is
tracked, nothing is loaded from elsewhere).

## Compact

The sidebar is a list in a drawer opened from the header. The canvas on the home page is
shorter and has fewer tools; the full set is in the demo. Code scrolls sideways inside its
block, never the page.

## Honesty

The site says what is true today: early, built in days, used by one app (Klementine Tiles),
not on npm, the Svelte layer needs klementine.ui which is not public. Every example on a page
runs the code it shows.
