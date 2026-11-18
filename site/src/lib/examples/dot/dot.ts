import { ShapeUtil, StateNode } from '@klementine/draw';
import type { Box, PointerInfo, ShapeRecord, StyleKey, Vec } from '@klementine/draw';

/** A voting dot, as plain data: its record. */
export type DotShape = ShapeRecord<'dot', { r: number }>;

/** What the engine knows about a dot: size, touch, resize. */
export class DotUtil extends ShapeUtil<DotShape> {
	static override kind = 'dot';
	// The style panel offers only a colour for dots.
	override readonly styles: readonly StyleKey[] = ['color'];

	defaultProps() {
		return { r: 12 };
	}

	bounds(shape: DotShape): Box {
		const d = shape.props.r * 2;
		return { x: 0, y: 0, w: d, h: d };
	}

	override hitTest(shape: DotShape, point: Vec, margin: number) {
		const { r } = shape.props;
		return Math.hypot(point.x - r, point.y - r) <= r + margin;
	}

	override outline(shape: DotShape) {
		const { r } = shape.props;
		const arc = `a${r},${r} 0 1,0`;
		return `M0,${r}${arc} ${r * 2},0${arc} ${-r * 2},0z`;
	}

	// A vote is a vote: dots keep their size.
	override canResize() {
		return false;
	}

	resize(shape: DotShape) {
		return { x: shape.x, y: shape.y, props: shape.props };
	}
}

/** Waits for a click; each click puts a dot there. */
class Idle extends StateNode {
	static override id = 'idle';

	override onEnter() {
		this.editor.cursor.set('crosshair');
	}

	override onPointerDown(event: PointerInfo) {
		if (event.button !== 0) return;
		const { editor } = this;
		const { x, y } = editor.inputs.page;
		const r = 12;
		editor.history.mark();
		// Red, like the stickers in a workshop, so a dot shows on any note.
		const style = { color: 'red' as const };
		editor.createShape({ kind: 'dot', x: x - r, y: y - r, style });
		editor.history.mark();
	}

	override onCancel() {
		this.editor.setTool('select');
	}
}

/** The dot tool: a state machine with one state. */
export class DotTool extends StateNode {
	static override id = 'dot';
	static override initial = 'idle';
	static override children = () => [Idle];
}
