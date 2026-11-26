## Two layers

| Layer                         | Import                           | What                                                               |
| ----------------------------- | -------------------------------- | ------------------------------------------------------------------ |
| Core (`src/lib/core`)         | `@klementine/svelte-draw`        | the store, undo, the editor, the base classes for shapes and tools |
| Built-ins (`shapes`, `tools`) | `@klementine/svelte-draw`        | select, pens, eraser, shapes, lines, text, notes, frames, groups   |
| Svelte (`src/lib/svelte`)     | `@klementine/svelte-draw/svelte` | the canvas, the views of the built-in shapes, the minimap          |

The core never imports Svelte. It is plain TypeScript that Node runs as it is, so the tests drag
shapes around without a browser and a server can open a board to read or change it.

## Five ideas

### 1. Everything is a record in one store

A shape is plain data: its `kind`, where it is (`x`, `y`, `rotation` in its parent), what it
sits in (`parentId`: a page, a group or a frame), its place in the stack (`index`), its `style`
and its `props`. Pages and pictures are records too. Every write lands in a diff, records
`added`, `updated` (before and after) and `removed`, and is announced with where it came from:
this user, or `remote`.

### 2. Undo is a listener on that stream

The history folds this user's diffs into steps. A tool calls `history.mark()` before an
interaction, so a whole drag undoes as one step. Changes from elsewhere are never recorded: undo
takes back only what you did.

### 3. A kind of shape is a class

A `ShapeUtil` knows everything about one kind: its default props, its box, what counts as
touching it, its outline, how it resizes, and what else it is (whether it holds text, which
styles it has, whether it is a group or a frame, what it is tied to). It draws nothing; the
Svelte layer pairs each kind with a view. The editor asks the class and never names a kind, so
your kinds are as much at home as the built-in ones.

### 4. A tool is a state machine

A tool is a `StateNode` whose states are children: the select tool has `idle`, `pointing`,
`translating`, `resizing`, `rotating` and more. An event walks down the active path, so each
state only says what it does with an event while it is the active one. No flags.

### 5. The editor ties them together

The `Editor` holds the store, the history, the tools, the camera and the selection, and has a
method for everything a person does on the canvas. The canvas turns the browser's events into
the editor's events and calls `dispatch`; a test or a script calls the same methods.

## Reactivity

The core's values are small signals (`Atom`). The Svelte layer hooks their reads into Svelte, so
`editor.camera.get()` in a template is reactive, one record at a time: moving one shape redraws
that shape.

## Where things are

| Folder         | What                                                                                       |
| -------------- | ------------------------------------------------------------------------------------------ |
| `core/`        | the store, undo, the base classes, saving, and the `Editor` class                          |
| `core/editor/` | the editor's methods, one file per concern (selection, clipboard, arrange, groups, frames) |
| `shapes/`      | one file per kind of shape                                                                 |
| `tools/`       | one file per tool; `tools/select/` one per state of the select tool                        |
| `browser/`     | the only engine code that needs a browser: IndexedDB, the channel between tabs             |
| `svelte/`      | the components; `svelte/canvas/` the canvas's own logic                                    |
