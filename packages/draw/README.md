# Klementine Draw

An infinite canvas for Svelte: draw, write, drag out shapes, connect them with arrows, group,
frame, turn, snap, copy and paste, undo. Shapes and tools are plugins, so the same engine can be
a whiteboard today and a design tool later. What is built and what is not:
[FEATURES.md](../../FEATURES.md).

```svelte
<script lang="ts">
	import { Draw } from '@klementine/draw/svelte';
</script>

<div class="h-dvh"><Draw persistenceKey="my-board" minimap deepLinks /></div>
```

`persistenceKey` keeps the board in the browser and in step with its other tabs; without it the
board lives as long as the page. `readOnly` shows it without letting it be changed.

```css
@import 'tailwindcss';
@import '@klementine/ui/theme.css';
@import '@klementine/draw/draw.css';
```

The controls are composed from klementine.ui (`@klementine/ui`: Toolbar, ToggleGroup, Tooltip,
Kbd, DropdownMenu, ContextMenu) and the canvas is drawn on its theme tokens; it is a peer
dependency the app brings. Hand-drawn text wants a handwriting font: load one and name it in
`--kd-font-hand` (the example loads Caveat).

## How it is built

Two layers. The core never imports Svelte.

| Layer                         | Import                    | What                                                                             |
| ----------------------------- | ------------------------- | -------------------------------------------------------------------------------- |
| Core (`src/lib/core`)         | `@klementine/draw`        | the store, undo, the editor, the base classes for shapes and tools               |
| Built-ins (`shapes`, `tools`) | `@klementine/draw`        | select, hand, pens, eraser, geo shapes, lines, text, frames, groups: all plugins |
| Svelte (`src/lib/svelte`)     | `@klementine/draw/svelte` | `Canvas`, the views of the built-in shapes, `DrawToolbar`, `StylePanel`, `Draw`  |

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
   calls the same methods (`tests/core.test.ts` drags shapes with no browser).

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
<Draw plugins={[...defaultPlugins, myPlugin]} />
```

### Text that can be typed into

A util that returns `true` from `canEdit()` gets a double click and Enter: the editor sets
`editor.editing` to the shape, and the view shows the text field with `editText`
(`@klementine/draw/svelte`). Escape, a press elsewhere or a tool switch ends it; everything typed
is one undo step. A box tool with `edit = true` (the note's) starts typing as soon as the shape
is made. The note (`svelte/note-view.svelte`) is the reference.

## Collaboration (the seam; tabs use it, a server does not yet)

Sync is two calls on the store: listen for `user` diffs and send them; apply what arrives as
`remote`.

```ts
editor.store.listen((diff, source) => source === 'user' && send(diff));
onReceive((diff) => editor.store.applyDiff(diff, 'remote'));
```

Records are whole documents keyed by id, which is the shape a Convex table wants (one row per
record, last write wins per record; stacking order is a fractional index, so two people can
reorder at once). `tests/core.test.ts` runs two editors against each other this way.

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
  clipboard as JSON under `application/x-klementine-draw`, with the files they show.
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

## Where the ideas come from

The architecture follows the ideas of [tldraw](https://tldraw.dev) (records in a reactive
store, a `ShapeUtil` per kind, tool state machines, a plugin as an array of classes), learned
by reading how it is designed. No tldraw code, icons or assets are in this package and it
depends on no tldraw package: tldraw's editor is under a licence that forbids production use
without a key, and a port would inherit that, so this is written from scratch. tldraw is a
trademark of tldraw Inc.; this project is not affiliated with or endorsed by it.

Ink strokes use `perfect-freehand` (MIT), stacking order `fractional-indexing` (CC0), icons
Phosphor (MIT).
