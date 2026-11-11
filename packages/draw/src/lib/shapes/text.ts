/*
 * The text shape: words on the canvas with no box around them. The core cannot measure text,
 * so the size it works with is the one the view measured on this screen
 * (`editor.getMeasured`), which is not part of the document. The `w` and `h` in the props
 * are what a screen last saw when the text was typed: they stand in where nothing measures
 * (a test, a server), and `w` is the width the words wrap at once the text was resized.
 */

import type { Box } from '../core/geometry.ts';
import { FONT_SIZE, type ShapeRecord, type StyleKey } from '../core/records.ts';
import { ShapeUtil, type ResizeResult } from '../core/shape-util.ts';
import { StateNode } from '../core/state-node.ts';
import type { PointerInfo } from '../core/events.ts';

export type TextProps = {
	text: string;
	/** The size of the words when they were last typed (see above). */
	w: number;
	h: number;
	/** True while the width follows the words; false once a width was set by resizing. */
	auto: boolean;
};

export type TextShape = ShapeRecord<'text', TextProps>;

export class TextShapeUtil extends ShapeUtil<TextShape> {
	static override kind = 'text';
	override readonly styles: readonly StyleKey[] = ['color', 'size', 'font', 'align', 'opacity'];

	defaultProps(): TextProps {
		return { text: '', w: 8, h: 32, auto: true };
	}

	bounds(shape: TextShape): Box {
		const measured = this.editor.getMeasured(shape.id);
		return {
			x: 0,
			y: 0,
			w: shape.props.auto ? (measured?.w ?? shape.props.w) : shape.props.w,
			h: measured?.h ?? shape.props.h
		};
	}

	override fromText(text: string): TextProps {
		return { ...this.defaultProps(), text };
	}

	override canEdit() {
		return true;
	}

	/**
	 * A text with no words left is removed. Otherwise the size this screen measured is kept
	 * with the words, in the same undo step as the typing.
	 */
	override onEditEnd(shape: TextShape) {
		const { editor } = this;
		if (shape.props.text.trim() === '') return editor.deleteShapes([shape.id]);
		const measured = editor.getMeasured(shape.id);
		if (!measured) return;
		const w = shape.props.auto ? measured.w : shape.props.w;
		if (Math.abs(w - shape.props.w) > 0.5 || Math.abs(measured.h - shape.props.h) > 0.5)
			editor.updateShape(shape.id, { props: { w, h: measured.h } });
	}

	/** Resizing sets the width the words wrap at; the height follows the words. */
	resize(shape: TextShape, target: Box): ResizeResult<TextShape> {
		return {
			x: target.x,
			y: target.y,
			props: { ...shape.props, w: Math.max(24, target.w), auto: false }
		};
	}
}

class Idle extends StateNode {
	static override id = 'idle';

	override onEnter() {
		this.editor.cursor.set('text');
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

	/**
	 * The release puts a text there and starts typing into it. Not the press: the press still
	 * gives the canvas the keyboard, and would take it away from the new text again.
	 */
	override onPointerUp() {
		const { editor } = this;
		const size = FONT_SIZE[editor.style.peek().size];
		editor.history.mark();
		const shape = editor.createShape({
			kind: 'text',
			x: editor.inputs.page.x,
			y: editor.inputs.page.y - size * 0.65,
			props: { h: size * 1.3 }
		});
		editor.startEditing(shape.id, { creating: true });
	}

	override onCancel() {
		this.parent!.transition('idle');
	}
}

export class TextTool extends StateNode {
	static override id = 'text';
	static override initial = 'idle';
	static override children = () => [Idle, Pointing];
}
