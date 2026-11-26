# svelte-draw

An infinite canvas for Svelte: draw, write, drag out shapes, connect them with arrows, group,
frame, turn, snap, copy and paste, undo. Shapes and tools are plugins, so the same engine can be
a whiteboard today and a design tool later.

> **Early development.** Draw works, and it is young. Its API will change between releases
> without notice, and parts of it are little tested. Pin the version you install, and check
> [what is built](https://docs.simon-lund.com/svelte-draw/docs/features/) before you rely on a
> part of it.

Documentation, with a board to draw on: <https://docs.simon-lund.com/svelte-draw/>.

```sh
npm install @klementine/svelte-draw
```

```svelte
<script lang="ts">
	import { Editor } from '@klementine/svelte-draw';
	import { Canvas, defaultPlugins } from '@klementine/svelte-draw/svelte';
	import '@klementine/svelte-draw/draw.css';

	const editor = new Editor({ plugins: defaultPlugins });
</script>

<div style="height: 100dvh">
	<Canvas {editor} plugins={defaultPlugins} label="Whiteboard" />
</div>
```

That is a whiteboard, worked by its keys. (`@klementine` is the author's organization on npm.) It needs Svelte 5.57 or newer and nothing else: the
styles are plain CSS on a few custom properties (`--kd-ground`, `--kd-ink`, …), and the engine
alone (without `/svelte`) is plain TypeScript. Hand-drawn text wants a handwriting font: load
one and name it in `--kd-font-hand`.

The library brings no toolbar, panels or menus: those are your app's. Build them on the editor,
or copy the set in the repository's
[whiteboard example](https://github.com/simon-lund/svelte-draw/tree/main/examples/whiteboard/src/lib/ui).

svelte-draw is built with AI: its code, tests and documentation are written by AI coding agents
(Claude Code), directed by its author.

## How it is built

Two layers. The core never imports Svelte.

| Layer                         | Import                           | What                                                                             |
| ----------------------------- | -------------------------------- | -------------------------------------------------------------------------------- |
| Core (`src/lib/core`)         | `@klementine/svelte-draw`        | the store, undo, the editor, the base classes for shapes and tools               |
| Built-ins (`shapes`, `tools`) | `@klementine/svelte-draw`        | select, hand, pens, eraser, geo shapes, lines, text, frames, groups: all plugins |
| Svelte (`src/lib/svelte`)     | `@klementine/svelte-draw/svelte` | `Canvas`, the views of the built-in shapes, `Minimap`                            |

The core in five ideas:

1. **Everything is a record in one store** (`store.ts`). A shape is plain data (`kind`, `x`,
   `y`, `parentId`, `index`, `style`, `props`). Every write lands in a diff
   (`added` / `updated` / `removed`) that is announced with its source, `user` or `remote`.
2. **Undo is a listener on that stream** (`history.ts`). It folds `user` diffs into steps; a tool
   calls `mark()` before an interaction, so a whole drag undoes as one. Remote changes are never
   recorded.
3. **A shape kind is a `ShapeUtil`** (`shape-util.ts`): default props, bounds, hit test, outline,
   resize, and what else the kind is (`canEdit`, its own `handles`, its `styles`, whether it is
   a `group` or a `frame`, what it is tied to). No rendering: the Svelte layer pairs each kind
   with a view. The editor asks the util and never names a kind.
4. **A tool is a state machine** (`state-node.ts`). States nest (`select` → `idle`,
   `translating`, `resizing`, `brushing`); an event walks down the active path. No flags.
5. **The editor ties them together** (`editor.ts`): camera, selection, hit testing, `dispatch`.
   The renderer turns DOM events into `DrawEvent`s and calls `dispatch`; a test or a script
   calls the same methods (the tests drag shapes with no browser).

Where things are in `src/lib`:

| Folder         | What                                                                                                                                                                                                                                                                 |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `core/`        | the store, undo, the base classes, saving (`persist.ts`), and `editor.ts`: the `Editor` class with its state, the event loop and the document writes                                                                                                                 |
| `core/editor/` | the rest of the editor's methods, one file per concern (`space`, `tree`, `selection`, `content`, `arrange`, `groups`, `frames`, `snapping`, `view`), plus its `types` and `constants`. Each is a function that takes the editor; the class method is a one-line call |
| `shapes/`      | one file per kind (the line's geometry and the geo outlines have a file of their own)                                                                                                                                                                                |
| `tools/`       | one file per tool; `tools/select/` has one file per state of the select tool                                                                                                                                                                                         |
| `browser/`     | the only engine code that needs a browser: IndexedDB storage, the channel between tabs, the default asset store                                                                                                                                                      |
| `svelte/`      | components; `svelte/canvas/` holds the canvas's logic (input, pinch, clipboard, what is on screen)                                                                                                                                                                   |
| `../../tests/` | the engine's, under Node (`pnpm test`): one file per area (`store`, `tools`, `lines`, `shapes`, `transform`, `arrange`, `persist`) and `helpers.ts`; `browser/`: the Svelte layer in Chrome (`pnpm test:browser`)                                                    |

Reactivity: the core's values are `Atom`s (`signal.ts`). `svelte/reactive.ts` hooks their reads
into Svelte with `createSubscriber`, so `editor.camera.get()` in a template is reactive, one
record at a time.

## A plugin

A plugin is a list of classes plus, for the screen, a view and a toolbar entry. The built-in
kinds are plugins too; the sticky note (`shapes/note.ts`, `svelte/note-view.svelte`) reads like
this, and a kind of your own is written the same way outside the package (name it something
else: a kind can be registered once):

```ts
class NoteShapeUtil extends ShapeUtil<NoteShape> {
	static override kind = 'note';
	defaultProps() {
		return { w: 180, h: 180, text: '' };
	}
	bounds(shape) {
		return { x: 0, y: 0, w: shape.props.w, h: shape.props.h };
	}
	resize(shape, target) {
		return { x: target.x, y: target.y, props: { ...shape.props, w: target.w, h: target.h } };
	}
}

class NoteTool extends BoxTool {
	static override id = 'note';
	shape = { kind: 'note' };
}

export const notePlugin: DrawSveltePlugin = {
	name: 'note',
	shapes: [NoteShapeUtil],
	tools: [NoteTool],
	shortcuts: { n: 'note' },
	views: { note: NoteView },
	toolbar: [{ tool: 'note', label: 'Note', icon: Note, shortcut: 'N' }]
};
```

```svelte
<Canvas {editor} plugins={[...defaultPlugins, myPlugin]} label="Whiteboard" />
```

### Text that can be typed into

A util that returns `true` from `canEdit()` gets a double click and Enter: the editor sets
`editor.editing` to the shape, and the view makes its text element the field with the
`editText` attachment (`@klementine/svelte-draw/svelte`):

```svelte
<span {@attach editText({ editor, text: () => shape.props.text, onchange })}></span>
```

`text` is read once, as the edit starts: while someone types, the field is theirs. Escape, a
press elsewhere or a tool switch ends it; everything typed is one undo step. A box tool with
`edit = true` (the note's) starts typing as soon as the shape is made. The note
(`svelte/note-view.svelte`) is the reference.

## Collaboration (the seam; tabs use it, a server does not yet)

Sync is two calls on the store: listen for `user` diffs and send them; apply what arrives as
`remote`.

```ts
editor.store.listen((diff, source) => source === 'user' && send(diff));
onReceive((diff) => editor.store.applyDiff(diff, 'remote'));
```

Records are whole documents keyed by id, which is the shape a Convex table wants (one row per
record, last write wins per record; stacking order is a fractional index, so two people can
reorder at once). `tests/store.test.ts` runs two editors against each other this way.

## How the bigger pieces work

- **Place and turn.** A shape has `x`, `y` and `rotation` in its parent's space (a page, a
  group, a frame). `editor.shapeToPage` and `pageToShape` are the only way between spaces; hit
  tests, attached arrows and clipping all go through them.
- **Attached lines.** A line keeps the id of the shape an end is tied to and works the end out
  when it is read (`lineEnds`), aimed at the shape's middle and stopped at its outline
  (`ShapeUtil.edgePoint`). Moving the shape writes nothing to the line. When a tied shape is
  moved alone, copied or loses its target, the editor calls `retie`, and the end stays where it
  shows.
- **Groups** are shapes with no picture; `editor.getSelectable` turns a click on a child into
  the group, `focusedGroup` is the group that was stepped into. Resizing works on the leaves.
- **Frames** take in what is dropped on them (`editor.settle`, called at the end of a move, a
  resize or a new shape) and the view cuts their children off with a `clip-path`.
- **Snapping** is `editor.snapBox` and `snapPoint`: other shapes' edges and middles, with the
  guides in `editor.snapLines`.
- **Clipboard.** `editor.getContent` gives records that stand on their own (on the page, tied
  only to each other); `putContent` adds them with new ids. The canvas puts them on the system
  clipboard as JSON under `application/x-svelte-draw`, with the files they show.
- **Saving and tabs** (`core/persist.ts`). `persist(editor, { storage, channel })` loads the
  document, then writes every change of this user record by record and posts it to the
  channel; what arrives from the channel is applied as `remote`. `DocumentStorage` and
  `Channel` are two small interfaces: IndexedDB and BroadcastChannel are the ones built, a
  server's would be two more. Who else is there (`editor.peers`: pointer, selection, laser)
  travels on the same channel and is never in the document.
- **Files** are asset records; a shape holds the asset's id. `editor.assets.upload(file)`
  decides where a file goes (by default into the document, as a data URL).
- **Pages** are records; `editor.setPage` shows another one. Shapes hang on a page through
  `parentId`.
- **What other kinds can say about themselves** on their `ShapeUtil`: `fromText` and
  `fromFile` (made from pasted text or a dropped file), `assets`, `toggles` (switches in the
  right-click menu), `rotate`, `onEditEnd`. The editor asks; it never names a kind.
- **Pictures** (`svelte/export.ts`): `toSvg` and `toPng` copy the shapes' elements into an
  SVG with their styles and fonts packed in.

## Credits

Draw's architecture is inspired by [tldraw](https://tldraw.dev): records in a reactive store,
one class per kind of shape, tools as state machines. Draw is an independent project, written
from scratch for Svelte; it contains no tldraw code and is not affiliated with tldraw Inc.

Ink strokes use `perfect-freehand` (MIT), stacking order `fractional-indexing` (CC0), icons
Phosphor (MIT).
