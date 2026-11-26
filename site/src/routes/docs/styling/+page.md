## A shape's style

Every shape has the same style record; each kind shows only the styles it has (a line has no
fill, a text has a typeface), and so does the style panel.

| Style     | Values                                                                                 |
| --------- | -------------------------------------------------------------------------------------- |
| `color`   | `ink`, `grey`, `white`, `yellow`, `red`, `green`, `blue`, `violet` and four light ones |
| `fill`    | `none`, `tint`, `solid`, `pattern`                                                     |
| `size`    | `s`, `m`, `l`, `xl`                                                                    |
| `look`    | `sketch` (drawn by hand), `precise`, `dashed`, `dotted`                                |
| `font`    | `hand`, `sans`, `serif`, `mono`                                                        |
| `align`   | `start`, `middle`, `end`; in shapes also `valign`: `top`, `middle`, `bottom`           |
| `opacity` | from 0 to 1; the panel offers five steps                                               |

`editor.setStyle({ color: 'blue' })` sets it on what is selected and on the next shape.

## The theme

The canvas is drawn on klementine.ui's tokens, so it follows light and dark with the rest of
the app. Its own classes start with `kd-` and live in `@simon-lund/svelte-draw/draw.css`. The colours
of shapes are named variables you can set:

```css
.kd-root {
	--kd-blue: light-dark(#2f6bd8, #74a5f5);
	--kd-font-hand: 'Caveat', cursive;
}
```

## Your own arrangement

`Draw` is a convenience. The parts are exported, and you compose them as you like: a canvas
with only a toolbar, or controls of your own around it.

```svelte
<script lang="ts">
	import { Editor } from '@simon-lund/svelte-draw';
	import { Canvas, defaultPlugins, DrawToolbar, ZoomControl } from '@simon-lund/svelte-draw/svelte';

	const editor = new Editor({ plugins: defaultPlugins });
</script>

<Canvas {editor} plugins={defaultPlugins} label="Whiteboard">
	<DrawToolbar
		{editor}
		plugins={defaultPlugins}
		class="absolute bottom-3 left-1/2 -translate-x-1/2"
	/>
	<ZoomControl {editor} class="absolute bottom-3 left-3" />
</Canvas>
```

The toolbar shows the tools of the plugins you give it, so a smaller list makes a smaller
toolbar. The board on this site's home page does that on a phone.

## Other languages

The controls' words are English. Pass `labels` to translate all of them or a few; the rest stay
English. A plugin's tool names travel with the plugin (`toolbar[].label`).

```svelte
<script lang="ts">
	import { defaultLabels, Draw } from '@simon-lund/svelte-draw/svelte';

	const labels = { ...defaultLabels, undo: 'Rückgängig', redo: 'Wiederholen' };
</script>

<Draw {labels} />
```
