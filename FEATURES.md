# Klementine Draw and tldraw, feature by feature

What tldraw offers (its SDK's default shapes, tools and documented features, read from the clone
in `~/workspaces/references/tldraw` at commit 017ae8f, 2026-11-10) and where Klementine Draw stands. Checked
on 2026-11-11. This is the one list of what is built and what is not; update it with the code.

**Yes**: built and tested. **Partly**: the core of it works, the rest of the line says what is
missing. **No**: not built. The last column says what is still open, and where a decision of
Simon's is needed before it can be built.

## Shapes

| tldraw                            | Draw   | What is there, what is missing                                                                                                                                                         |
| --------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Freehand drawing                  | Yes    | Pen pressure, hand-drawn stroke (`perfect-freehand`).                                                                                                                                  |
| Highlighter                       | Yes    | A wide, see-through stroke; key M.                                                                                                                                                     |
| Geometric shapes (20 kinds)       | Yes    | 19 kinds (all but tldraw's second rhombus). Eight are in the toolbar; the others are made from code (`geoTool('octagon')`).                                                            |
| Text inside shapes                | Yes    | Double click a shape and type. Plain text; the shape does not grow with it; no choice of top or bottom.                                                                                |
| Text                              | Yes    | Key T. As wide as its words, or wrapping once it is resized. Resizing does not scale the type.                                                                                         |
| Arrows                            | Partly | Straight, attach to shapes, follow them, stop at the outline. Missing: curved and elbow arrows, a chosen point on the shape, text on an arrow, a head at the start, other head styles. |
| Lines                             | Partly | Two ends, straight. Missing: more than two points, curves.                                                                                                                             |
| Sticky notes                      | Partly | In the example as a plugin (`examples/whiteboard/src/note`), not in the package. Missing: the buttons that add the next note beside one.                                               |
| Frames                            | Partly | Hold shapes, move them, cut them off at the edge, have a name. Missing: frames in frames, fit to content.                                                                              |
| Groups                            | Yes    | Ctrl G, Ctrl Shift G; double click steps in.                                                                                                                                           |
| Images and video                  | No     | **Simon's call**: where the files are kept.                                                                                                                                            |
| Bookmarks and embeds (YouTube, …) | No     | Later.                                                                                                                                                                                 |

## Tools and editing

| tldraw                        | Draw   | What is there, what is missing                                                                                              |
| ----------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------- |
| Select, move, resize, marquee | Yes    | Shift keeps proportions or one axis. Missing: resize from the middle (Alt).                                                 |
| Hand (move the view)          | Yes    |                                                                                                                             |
| Eraser                        | Yes    | Key E; drag over shapes, one undo step.                                                                                     |
| Rotate                        | Partly | Handle above the selection, Shift for 15° steps. Several shapes turned differently cannot be resized together.              |
| Snapping                      | Partly | Edges and middles of other shapes, while moving and resizing; Ctrl lets go. Missing: equal gaps, the grid, a line's ends.   |
| Undo, redo                    | Yes    | Only your own changes.                                                                                                      |
| Copy, cut, paste              | Partly | Between canvases through the system clipboard; plain text pastes as a text. Missing: images, files, links; copy as picture. |
| Duplicate                     | Yes    | Ctrl D, or hold Alt while dragging.                                                                                         |
| Align, space evenly, flip     | Yes    | In the right-click menu. Missing: stretch, stack.                                                                           |
| Order (front, forward, …)     | Yes    | Keys ] and [, Alt for one step.                                                                                             |
| Lock                          | Yes    | In the right-click menu.                                                                                                    |
| Typing into shapes            | Partly | Plain text. tldraw has rich text (bold, lists, links).                                                                      |
| Laser pointer                 | No     | Later; it matters once others watch.                                                                                        |
| Zoom tool, lasso select       | No     | Later.                                                                                                                      |
| Crop                          | No     | With images.                                                                                                                |

## Styles

| tldraw                             | Draw   | What is there, what is missing                         |
| ---------------------------------- | ------ | ------------------------------------------------------ |
| Colour (13)                        | Partly | 7 colours. No orange, on purpose.                      |
| Fill (none, semi, solid, pattern)  | Partly | None, light, full. Missing: the hatched pattern.       |
| Dash (draw, solid, dashed, dotted) | Yes    | Hand-drawn, exact, dashed, dotted.                     |
| Size (S, M, L, XL)                 | Partly | S, M, L.                                               |
| Font (draw, sans, serif, mono)     | Yes    | The app loads the handwriting font (`--kd-font-hand`). |
| Text alignment                     | Partly | Left, centre, right. Missing: top, middle, bottom.     |
| Opacity                            | Yes    | Five steps.                                            |

The style panel shows only the styles the selected kinds have.

## Canvas

| tldraw                               | Draw   | What is there, what is missing                                                             |
| ------------------------------------ | ------ | ------------------------------------------------------------------------------------------ |
| Pan, zoom, fit, zoom to selection    | Yes    |                                                                                            |
| Pinch and two-finger pan on touch    | Partly | Built; not tried on a touch screen yet.                                                    |
| Right-click menu                     | Yes    | From klementine.ui's ContextMenu; a long press opens it on touch.                          |
| Light and dark                       | Yes    | From the theme's tokens.                                                                   |
| Grid                                 | Partly | Dots are shown. Missing: snap to grid, switching it off.                                   |
| Keyboard shortcuts                   | Partly | Tools, clipboard, group, order, nudge. Missing: the rest of tldraw's set, a shortcut list. |
| Pages                                | No     | **Simon's call**: the data has pages, the canvas shows one.                                |
| Minimap                              | No     | Later.                                                                                     |
| Scrolling at the edge while dragging | No     | Later.                                                                                     |
| Skipping shapes that are off screen  | No     | Later; matters with thousands of shapes.                                                   |
| Read-only and focus mode             | No     | Later.                                                                                     |
| Accessibility                        | Partly | Controls are named and keyboard-reachable; shapes are not reachable without a pointer.     |
| Languages                            | Partly | English, and a `labels` prop to translate. tldraw ships about fifty.                       |
| Links to a place on the canvas       | No     | Later.                                                                                     |

## Data and platform

| tldraw                                   | Draw   | What is there, what is missing                                                                                                |
| ---------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Reactive store, diffs, history           | Yes    |                                                                                                                               |
| Own shapes and tools                     | Yes    | A plugin is a list of classes; the example's note is one.                                                                     |
| Bindings                                 | Partly | tldraw keeps them as records of their own, open to plugins. Draw keeps a line's ties in the line (`ties`, `retie` on a util). |
| Checking and migrating stored documents  | No     | Needed before real documents are kept.                                                                                        |
| Hooks before and after a change          | No     | Later.                                                                                                                        |
| Save and load                            | Partly | `store.snapshot()` and a store handed to the editor. Missing: a file format, a load helper.                                   |
| Storage in the browser, sync across tabs | No     | **Simon's call**: Convex is the plan.                                                                                         |
| Collaboration, cursors, following        | No     | The seam is there (`store.listen`, `applyDiff`), tested with two editors. The Convex adapter is deferred.                     |
| Export (PNG, SVG, JSON)                  | No     | **Simon's call**: notes and text are HTML, so a picture needs a decision on how.                                              |
| Replacing parts of the UI                | Partly | Compose `Canvas`, `DrawToolbar`, `StylePanel`, `ZoomControl`, `CanvasMenu` yourself. tldraw has a slot for every part.        |
| Helpers for AI agents                    | No     | Later.                                                                                                                        |
| Licence                                  | n/a    | tldraw needs a licence key in production. Draw is ours; none of tldraw's code is in it.                                       |

## Known limits of what is built

- A diff carries whole records, so two people changing the same shape at the same moment
  overwrite each other's fields. The Convex adapter has to decide this.
- A text's size is measured by the view of whoever types into it or has it selected. A screen
  with other fonts may measure a few pixels differently.
- No app uses the package yet: it is run by its example and its tests.
