/*
 * The base of every „drag out a box“ tool (rectangle, ellipse, a plugin's sticky note). Press
 * and drag: the shape is made at the press and handed to the select tool's resizing state, so
 * dragging out a new shape and resizing an old one are the same code. A click without a drag
 * makes the shape at its default size, centred on the click.
 *
 * A subclass names the shape:
 *
 *   class NoteTool extends BoxTool {
 *     static override id = 'note';
 *     override shape = { kind: 'note' };
 *   }
 */

import { StateNode } from '../core/state-node.ts';
import type { PointerInfo } from '../core/events.ts';
import type { ShapeStyle } from '../core/records.ts';

export interface BoxToolShape {
	kind: string;
	/** Props on top of the util's defaults. They must include nothing but what the kind knows. */
	props?: Record<string, unknown>;
	style?: Partial<ShapeStyle>;
}

class Idle extends StateNode {
	static override id = 'idle';

	override onEnter() {
		this.editor.cursor.set('crosshair');
	}

	override onPointerDown(event: PointerInfo) {
		if (event.button === 0) this.parent!.transition('pointing');
	}

	override onCancel() {
		this.editor.setTool('select');
	}
}

class Pointing extends StateNode {
	static override id = 'pointing';

	override onPointerMove() {
		const { editor } = this;
		if (!editor.inputs.isDragging) return;
		const { kind, props, style } = (this.parent as BoxTool).shape;
		editor.history.mark();
		const shape = editor.createShape({
			kind,
			x: editor.inputs.originPage.x,
			y: editor.inputs.originPage.y,
			props: { ...props, w: 1, h: 1 },
			style
		});
		editor.select([shape.id]);
		editor.setTool('select.resizing', {
			handle: 'bottom_right',
			creating: true,
			edit: (this.parent as BoxTool).edit
		});
	}

	override onPointerUp() {
		const { editor } = this;
		const { kind, props, style } = (this.parent as BoxTool).shape;
		const defaults = {
			...(editor.util(kind).defaultProps() as { w: number; h: number }),
			...props
		} as {
			w: number;
			h: number;
		};
		editor.history.mark();
		const shape = editor.createShape({
			kind,
			x: editor.inputs.page.x - defaults.w / 2,
			y: editor.inputs.page.y - defaults.h / 2,
			props,
			style
		});
		editor.settle([shape.id]);
		editor.history.mark();
		editor.select([shape.id]);
		if ((this.parent as BoxTool).edit) editor.startEditing(shape.id);
		else editor.setTool('select');
	}

	override onCancel() {
		this.editor.setTool('select');
	}
}

/** A tool that drags out a shape whose props have `w` and `h`. */
export abstract class BoxTool extends StateNode {
	static override initial = 'idle';
	static override children = () => [Idle, Pointing];

	/** The shape this tool makes. */
	abstract shape: BoxToolShape;

	/** True when the new shape is typed into straight away (a sticky note). */
	edit = false;
}
