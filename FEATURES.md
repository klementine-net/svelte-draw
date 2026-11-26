# svelte-draw: what is built

What svelte-draw can do, feature by feature. This is the one list of what is built and
what is not; it changes with the code.

The library is the engine and the canvas. The controls this list names (the toolbar, the style
panel, the page menu, the zoom control, the right-click menu) are the whiteboard example's
(`examples/whiteboard/src/lib/ui`): the demo shows them, and an app copies them or builds its
own.

**Yes**: built. **Partly**: the core of it works, the rest of the line says what is missing.
**No**: not built. Yes does not mean proven in daily use: the last section says how each part
was checked, and nobody has worked on a board with this for a day yet.

## Shapes

| Feature              | Draw   | What is there, what is missing                                                                                                                 |
| -------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Freehand drawing     | Yes    | Pen pressure, hand-drawn stroke (`perfect-freehand`).                                                                                          |
| Highlighter          | Yes    | Key M.                                                                                                                                         |
| Geometric shapes     | Yes    | 19 kinds. Eight are in the toolbar; the others are made from code (`geoTool('octagon')`).                                                      |
| Text inside shapes   | Partly | Double click and type; left, centre, right and top, middle, bottom. Plain text; the shape does not grow with it.                               |
| Text                 | Yes    | Key T. As wide as its words, or wrapping once resized. Resizing does not scale the type.                                                       |
| Arrows               | Partly | Straight, bent or right-angled, attached to shapes, with words, a head at either end. Missing: a chosen point on the shape, other head styles. |
| Lines                | Partly | Two ends and a bend. Missing: more than two points.                                                                                            |
| Sticky notes         | Partly | In the package now (key N), text shrinks to fit. Missing: the buttons that add the next note beside one.                                       |
| Frames               | Yes    | Hold shapes, cut them off, have a name, sit in other frames. Missing: fit to content.                                                          |
| Groups               | Yes    | Ctrl G, Ctrl Shift G; double click steps in.                                                                                                   |
| Images               | Partly | Drop, paste or pick a file. Missing: crop, animated pictures are shown as they are, no video files.                                            |
| Bookmarks and embeds | Partly | A pasted web address becomes a link card; YouTube and Vimeo addresses a player. Missing: page titles and previews, players for other sites.    |

## Tools and editing

| Feature                       | Draw   | What is there, what is missing                                                                                             |
| ----------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------- |
| Select, move, resize, marquee | Yes    | Shift keeps proportions or one axis, Alt resizes from the middle.                                                          |
| Lasso select                  | Yes    | Alt-drag from the empty canvas.                                                                                            |
| Hand, zoom tool               | Yes    | Keys H and Z.                                                                                                              |
| Eraser                        | Yes    | Key E.                                                                                                                     |
| Laser pointer                 | Yes    | Key K. Other tabs see it.                                                                                                  |
| Rotate                        | Partly | Handle above the selection, Shift for 15° steps. Several shapes turned differently cannot be resized together.             |
| Snapping                      | Partly | Edges and middles of other shapes; the grid, when switched on in the right-click menu. Missing: equal gaps, a line's ends. |
| Undo, redo                    | Yes    | Only your own changes.                                                                                                     |
| Copy, cut, paste              | Yes    | Shapes (with their pictures) between canvases; pasted text, pictures and web addresses; copy as a picture in the menu.     |
| Duplicate                     | Yes    | Ctrl D, or Alt while dragging.                                                                                             |
| Align, space evenly, flip     | Yes    | In the right-click menu. Missing: stretch, stack.                                                                          |
| Order, lock                   | Yes    |                                                                                                                            |
| Typing into shapes            | Partly | Plain text. Missing: rich text (bold, lists, links).                                                                       |
| Crop                          | No     |                                                                                                                            |
| Scrolling at the edge         | Yes    | A drag that reaches the canvas's edge moves the view.                                                                      |

## Styles

| Feature                            | Draw | What is there, what is missing                           |
| ---------------------------------- | ---- | -------------------------------------------------------- |
| Colour (13)                        | Yes  | 12. No orange, on purpose.                               |
| Fill (none, semi, solid, pattern)  | Yes  | None, light, full, hatched.                              |
| Dash (draw, solid, dashed, dotted) | Yes  |                                                          |
| Size (S, M, L, XL)                 | Yes  |                                                          |
| Font (draw, sans, serif, mono)     | Yes  | The app loads the handwriting font (`--kd-font-hand`).   |
| Text alignment                     | Yes  | Left, centre, right; in shapes also top, middle, bottom. |
| Opacity                            | Yes  | Five steps.                                              |

## Canvas

| Feature                           | Draw   | What is there, what is missing                                                                                                     |
| --------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Pan, zoom, fit, zoom to selection | Yes    |                                                                                                                                    |
| Pinch and two-finger pan          | Partly | Built; not tried on a touch screen yet.                                                                                            |
| Pages                             | Yes    | The menu in the top left: go to, add, rename, delete. Each page keeps its view.                                                    |
| Minimap                           | Yes    | `Minimap`, placed above the canvas. Press or drag in it to go there.                                                               |
| Right-click menu                  | Yes    |                                                                                                                                    |
| Light and dark                    | Yes    |                                                                                                                                    |
| Grid                              | Yes    | Show and snap, in the right-click menu.                                                                                            |
| Skipping shapes off screen        | Yes    | Only what is in or near the view is drawn.                                                                                         |
| Read-only mode                    | Yes    | `editor.setReadOnly(true)`: the view moves, nothing changes. A canvas without controls is the canvas alone.                        |
| Links to a place on the canvas    | Yes    | `deepLink(editor)` keeps page and view in the address.                                                                             |
| Keyboard shortcuts                | Partly | Tools, clipboard, group, order, nudge. Missing: keys for the rarer commands, a list of the shortcuts.                              |
| Accessibility                     | Partly | Controls are named and keyboard-reachable; shapes are not reachable without a pointer.                                             |
| Languages                         | Partly | Tool names are English and travel with the plugins; the example's controls take one `labels` object. No translations come with it. |

## Data and platform

| Feature                                 | Draw   | What is there, what is missing                                                                                                                         |
| --------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Reactive store, diffs, history          | Yes    |                                                                                                                                                        |
| Own shapes and tools                    | Yes    | A plugin is a list of classes.                                                                                                                         |
| Bindings                                | Partly | A line keeps its ties in itself (`ties`, `retie` on a util). Missing: ties as records of their own, which a plugin could add kinds of.                 |
| Storage in the browser                  | Yes    | `persist` with `indexedDbStorage`: IndexedDB, written record by record.                                                                                |
| Sync across tabs                        | Yes    | Same key: tabs of one browser stay in step.                                                                                                            |
| Cursors of others                       | Partly | Pointer, selection and laser of the other tabs, with the name from `persist`'s `user`. Missing: following someone, cursor chat.                        |
| Collaboration over a server             | No     | The seam is a `Channel` (post and listen); tabs use it today. A Convex channel and storage are not written: they need a deployed backend.              |
| Checking and migrating stored documents | Partly | A version is saved with every document, bad records are left out on load, `migrate` is the place for steps. No step exists yet.                        |
| Save and load files                     | Yes    | Page menu: save to a file, open a file.                                                                                                                |
| Export                                  | Partly | Page menu: save as a picture (PNG of the page or the selection); `toSvg`, `toPng` in code. Pictures from other websites may be left out of it.         |
| Assets                                  | Yes    | `AssetStore` with one method, `upload`. By default a file stays in the document as a data URL.                                                         |
| Hooks before and after a change         | Partly | After: `store.listen`. Before: none.                                                                                                                   |
| Replacing parts of the UI               | Yes    | The library brings no controls: `Canvas` takes yours as its children, and `around` its surface (a menu's trigger). The example has a full set to copy. |
| Helpers for AI agents                   | No     |                                                                                                                                                        |
| Licence                                 | MIT    | Free to use, change and ship, in commercial products too.                                                                                              |

## Decisions made while building

1. **Files stay in the document by default.** An image is kept as a data URL in an asset
   record, so it is saved, synced and exported with everything else and needs no server. It
   makes documents large. An app passes `assets: { upload }` to the editor to keep files
   elsewhere (Convex file storage); nothing else changes.
2. **Saving is IndexedDB plus a channel between tabs**, behind two small interfaces
   (`DocumentStorage`, `Channel`). A Convex version implements the same two.
3. **Pictures are made from the screen** (the shapes' own elements inside an SVG), so a
   picture looks exactly like the canvas, fonts included. The price: it only works in a
   browser, and a picture loaded from another website can be missing from it.
4. **A text's size is not stored as truth.** Every screen measures its own text; the document
   keeps the last size only for places that cannot measure.
5. **Sticky notes are part of the package**, as a plugin like every other kind of shape.
6. **Sizes, colours and fills are small fixed sets**, not free values, and there is no orange.

## Known limits of what is built

- A diff carries whole records, so two people changing the same shape at the same moment
  overwrite each other's fields. A server sync has to decide this.
- An undo in one tab can take back something another tab changed in the same shape since.
- Deleted pictures stay in the document as asset records (so an undo can bring them back);
  nothing cleans them up yet.

## How it was checked

**Engine tests** (`packages/draw/tests`, 40, no browser) cover the store, undo, tools, every
shape kind's geometry, attached, bent and right-angled lines, text, eraser, rotation, groups,
frames, clipboard, arranging, snapping, the grid, pages, saving and tabs (with stand-ins for
IndexedDB and the channel), cursors, files and assets, read-only, scrolling at the edge.

**Browser tests** (`pnpm test:browser`, in Chrome) cover what only a browser can show. For
the canvas (7, `packages/draw/tests/browser`): typing into a note and a text shape (every key
written, the caret kept), a note's writing fitting its paper, a text shape's measured size,
the wheel, the canvas following its size, its own light and dark. For the example's controls
(13, `examples/whiteboard/tests`): picking tools from the bar and a group's menu, the
right-click menu with a sub-menu and a switch, a resting finger opening that menu, the keys coming back to the canvas when a menu
closes, renaming and adding pages, the style panel, undo and redo, zoom, hints, and menus and
hints following the board's scheme.

**No engine test, because the code only runs in a browser:** the minimap, links to a view, not
drawing what is off screen, picture export and copy as a picture, saving to and opening a file,
the hatched fill, focus mode, reading a picture file, IndexedDB itself, dropping and pasting
files.

**Tried in a browser (Chrome, desktop), with the pointer and the keys:** text tool, text in
shapes, right-click menu and Duplicate, rotating by the handle, frames taking in shapes, eraser, a pen stroke kept across
a reload, attached, bent and right-angled arrows with words and two heads, all 19 shape kinds,
an image added and kept across a reload, a new page and a page rename from the page menu,
picture export (compared by eye), two tabs in step with each other's cursor, laser, minimap,
links to a view, shapes off screen not drawn, a link card, a hatched fill, text position.

**Not tried in a browser:** real Ctrl+C and Ctrl+V, dropping a file, the file picker, Alt-drag,
lasso, grouping, lock, align, snapping guides, the grid, deleting a page from the menu, save and
open a file, copy as a picture, players for videos, read-only and focus mode, scrolling at the
edge. **Never run at all:** pinch on a touch screen.
