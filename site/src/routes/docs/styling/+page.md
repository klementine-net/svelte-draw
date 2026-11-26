## A shape's style

Every shape has the same style record; each kind shows only the styles it has (a line has no
fill, a text has a typeface).

| Style     | Values                                                                                 |
| --------- | -------------------------------------------------------------------------------------- |
| `color`   | `ink`, `grey`, `white`, `yellow`, `red`, `green`, `blue`, `violet` and four light ones |
| `fill`    | `none`, `tint`, `solid`, `pattern`                                                     |
| `size`    | `s`, `m`, `l`, `xl`                                                                    |
| `look`    | `sketch` (drawn by hand), `precise`, `dashed`, `dotted`                                |
| `font`    | `hand`, `sans`, `serif`, `mono`                                                        |
| `align`   | `start`, `middle`, `end`; in shapes also `valign`: `top`, `middle`, `bottom`           |
| `opacity` | from 0 to 1                                                                            |

`editor.setStyle({ color: 'blue' })` sets it on what is selected and on the next shape.

## The canvas's look

The styles are one file of plain CSS, `@klementine/svelte-draw/draw.css`. Every class in it
starts with `kd-`, and what the canvas takes from the page around it is a handful of custom
properties on `.kd-root`. Set them after the import to fit your app:

```css
.kd-root {
	--kd-ground: #fbfaf7; /* the canvas */
	--kd-ink: #1d1c18; /* strokes and text in the colour "ink", the selection's handles */
	--kd-line: rgb(0 0 0 / 0.16); /* the grid's dots, outlines */
	--kd-layer: #ffffff; /* what floats on the canvas: the minimap */
	--kd-select: #1d1c18; /* the selection and the keyboard focus */
	--kd-font-sans: 'Inter', sans-serif; /* small print: a frame's name, a link's card */
	--kd-font-hand: 'Caveat', cursive; /* hand-drawn text */
	--kd-blue: #2f6bd8; /* a shape colour; there is one per colour name */
}
```

The canvas is light. `<Canvas scheme="dark">` makes it dark, and `scheme="auto"` follows the
system; the defaults above have a value for each.

## Controls around the canvas

Controls are your app's. What you put inside `Canvas` lies above the surface: place it with
your own CSS. A control reads the editor and calls it, and stays in step by itself, because
the editor's values are reactive in a template.

```svelte
<Canvas {editor} plugins={defaultPlugins} label="Whiteboard">
	<div class="zoom">
		<button onclick={() => editor.zoomOut()}>−</button>
		<span>{Math.round(editor.camera.get().z * 100)}%</span>
		<button onclick={() => editor.zoomIn()}>+</button>
	</div>
</Canvas>
```

A right-click menu has to sit around the surface itself, because its trigger is the element
that is clicked. `around` is for that: it gets the surface as a snippet and renders it, handing
over the attributes and handlers the trigger wants on the element. The surface runs its own
handler first, so a right click selects what is under the pointer before the menu opens.

```svelte
<Canvas {editor} plugins={defaultPlugins} label="Whiteboard">
	{#snippet around(canvas)}
		<ContextMenu.Root>
			<ContextMenu.Trigger>
				{#snippet child({ props })}{@render canvas(props)}{/snippet}
			</ContextMenu.Trigger>
			<ContextMenu.Content>
				<ContextMenu.Item onSelect={() => editor.duplicateSelection()}>Duplicate</ContextMenu.Item>
			</ContextMenu.Content>
		</ContextMenu.Root>
	{/snippet}
</Canvas>
```

The
[whiteboard example](https://github.com/simon-lund/svelte-draw/tree/main/examples/whiteboard/src/lib/ui)
does all of this in full: toolbar, style panel, page menu, zoom control and right-click menu.

## Words

The library says little itself. A plugin names its tools (`toolbar[].label`), and `Canvas` and
`Minimap` take a `label` for screen readers. Everything else is said by your controls, in your
app's language. The example's controls take one `labels` object with all their words.
