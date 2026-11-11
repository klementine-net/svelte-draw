# Klementine Draw

An infinite canvas for Svelte: draw, drag out shapes, select, move, resize, undo. Shapes and
tools are plugins, so the same engine can be a whiteboard today and a design tool later.

```svelte
<script lang="ts">
	import { Draw } from '@klementine/draw/svelte';
</script>

<div class="h-dvh"><Draw /></div>
```

```css
@import 'tailwindcss';
@import '@klementine/ui/theme.css';
@import '@klementine/draw/draw.css';
```

The controls are composed from klementine.ui (`@klementine/ui`: Toolbar, ToggleGroup, Tooltip,
Kbd) and the canvas is drawn on its theme tokens; it is a peer dependency the app brings.

## How it is built

Two layers. The core never imports Svelte.

| Layer                         | Import                    | What                                                                            |
| ----------------------------- | ------------------------- | ------------------------------------------------------------------------------- |
| Core (`src/lib/core`)         | `@klementine/draw`        | the store, undo, the editor, the base classes for shapes and tools              |
| Built-ins (`shapes`, `tools`) | `@klementine/draw`        | select, hand, draw, rectangle, ellipse, line, arrow: plugins like any other     |
| Svelte (`src/lib/svelte`)     | `@klementine/draw/svelte` | `Canvas`, the views of the built-in shapes, `DrawToolbar`, `StylePanel`, `Draw` |

The core in five ideas:

1. **Everything is a record in one store** (`store.ts`). A shape is plain data (`kind`, `x`,
   `y`, `parentId`, `index`, `style`, `props`). Every write lands in a diff
   (`added` / `updated` / `removed`) that is announced with its source, `user` or `remote`.
2. **Undo is a listener on that stream** (`history.ts`). It folds `user` diffs into steps; a tool
   calls `mark()` before an interaction, so a whole drag undoes as one. Remote changes are never
   recorded.
3. **A shape kind is a `ShapeUtil`** (`shape-util.ts`): default props, bounds, hit test, outline,
   resize. No rendering: the Svelte layer pairs each kind with a view.
4. **A tool is a state machine** (`state-node.ts`). States nest (`select` → `idle`,
   `translating`, `resizing`, `brushing`); an event walks down the active path. No flags.
5. **The editor ties them together** (`editor.ts`): camera, selection, hit testing, `dispatch`.
   The renderer turns DOM events into `DrawEvent`s and calls `dispatch`; a test or a script
   calls the same methods (`tests/core.test.ts` drags shapes with no browser).

Reactivity: the core's values are `Atom`s (`signal.ts`). `svelte/reactive.ts` hooks their reads
into Svelte with `createSubscriber`, so `editor.camera.get()` in a template is reactive, one
record at a time.

## A plugin

A plugin is a list of classes plus, for the screen, a view and a toolbar entry. The demo's
sticky note (`examples/whiteboard/src/note/`) is one, written outside the package:

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
<Draw plugins={[...defaultPlugins, notePlugin]} />
```

### Text that can be typed into

A util that returns `true` from `canEdit()` gets a double click and Enter: the editor sets
`editor.editing` to the shape, and the view shows the text field with `editText`
(`@klementine/draw/svelte`). Escape, a press elsewhere or a tool switch ends it; everything typed
is one undo step. A new shape whose util says `canEdit` is typed into straight away. The example's
note (`examples/whiteboard/src/note`) is the reference.

## Collaboration (the seam, not yet a server)

Sync is two calls on the store: listen for `user` diffs and send them; apply what arrives as
`remote`.

```ts
editor.store.listen((diff, source) => source === 'user' && send(diff));
onReceive((diff) => editor.store.applyDiff(diff, 'remote'));
```

Records are whole documents keyed by id, which is the shape a Convex table wants (one row per
record, last write wins per record; stacking order is a fractional index, so two people can
reorder at once). `tests/core.test.ts` runs two editors against each other this way.

## Not built yet

- Arrows that stay attached to shapes (bindings) and dragging a line by its ends (it resizes by
  its box for now), a text shape of its own, rich text, frames (the data model has `parentId`; no shape uses
  it yet), images, eraser, copy and paste, rotation, snapping, export.
- The Convex adapter and presence (other people's cursors).
- Field-level merging: a diff carries whole records, so two people changing the same shape at
  the same moment (or an undo after someone else's edit to it) overwrite each other's fields.
  The Convex adapter has to decide this (patch per field, or a version check).
- No app uses the package yet: it is only run by its own example and tests.
- Two-finger pan and pinch on touch screens (a trackpad's pinch works; it arrives as a wheel).
- The Svelte layer's own words are English with a `labels` prop to translate them.

## Where the ideas come from

The architecture follows tldraw's (records in a reactive store, `ShapeUtil`, tool state
machines, a plugin as an array of classes): its source is in `~/workspaces/references/tldraw`
for study. No tldraw code, icons or assets are in this package: its editor is under a licence
that forbids production use without a key, and a port would inherit that. Ink strokes use
`perfect-freehand` (MIT).
