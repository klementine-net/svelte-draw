/* The select tool: nothing is happening: the pointer hovers, and a press decides what begins. */

import { box } from '../../core/geometry.ts';
import type { ShapeRecord } from '../../core/records.ts';
import { StateNode } from '../../core/state-node.ts';
import type { KeyInfo, PointerInfo } from '../../core/events.ts';
import { handleCursor } from './cursors.ts';

export class Idle extends StateNode {
	static override id = 'idle';

	override onEnter() {
		this.editor.cursor.set('default');
	}

	override onExit() {
		this.editor.hovered.set(null);
	}

	/** What a press at the pointer would pick: a shape, or the group it is in. */
	#target(): ShapeRecord | undefined {
		const { editor } = this;
		const leaf = editor.getShapeAtPoint(editor.inputs.page);
		return leaf && editor.getSelectable(leaf);
	}

	override onPointerMove() {
		const { editor } = this;
		const { screen } = editor.inputs;
		if (editor.getShapeHandleAt(screen) || editor.isRotateHandleAt(screen)) {
			editor.cursor.set('grab');
			editor.hovered.set(null);
			return;
		}
		const handle = editor.getHandleAt(screen);
		const rotation = editor.getSelectionFrame()?.rotation ?? 0;
		editor.cursor.set(handle ? handleCursor(handle, rotation) : 'default');
		editor.hovered.set(handle ? null : (this.#target()?.id ?? null));
	}

	override onPointerDown(event: PointerInfo) {
		const { editor } = this;
		if (event.button !== 0) return;
		const { screen, page } = editor.inputs;

		const own = editor.getShapeHandleAt(screen);
		if (own) return this.parent!.transition('dragging_handle', { handle: own });
		if (editor.isRotateHandleAt(screen)) return this.parent!.transition('rotating');
		const handle = editor.getHandleAt(screen);
		if (handle) return this.parent!.transition('resizing', { handle });

		// A press outside the group that was stepped into steps back out of it.
		const leaf = editor.getShapeAtPoint(page);
		if (!leaf || !editor.isInFocus(leaf)) editor.focusedGroup.set(null);
		const hit = leaf && editor.getSelectable(leaf);
		const selection = editor.selection.peek();
		if (hit) {
			if (event.shift) {
				// Shift adds to the selection, or takes the shape out of it.
				editor.select(
					selection.includes(hit.id)
						? selection.filter((id) => id !== hit.id)
						: [...selection, hit.id]
				);
				return this.parent!.transition('pointing_shape', { collapseTo: null });
			}
			const wasSelected = selection.includes(hit.id);
			if (!wasSelected) editor.select([hit.id]);
			// A click on one of several selected shapes narrows to it, but only on release:
			// a drag must still move them all.
			return this.parent!.transition('pointing_shape', { collapseTo: wasSelected ? hit.id : null });
		}

		// Inside the selection's box (a hollow shape's middle): still a grab of the selection.
		const bounds = editor.getSelectionBounds();
		if (bounds && box.contains(bounds, page) && editor.getSelectionRoots().length > 0)
			return this.parent!.transition('pointing_shape', { collapseTo: null, clearOnClick: true });

		this.parent!.transition('pointing_canvas');
	}

	/** A group is stepped into; a shape that holds text is typed into. */
	override onDoubleClick() {
		const { editor } = this;
		const { page } = editor.inputs;
		// Also in the empty middle of the one selected shape: a hollow box is written in there.
		const [only, ...more] = editor.getSelectedShapes();
		const inside =
			only && more.length === 0 && !editor.isLocked(only)
				? box.contains(editor.util(only.kind).bounds(only), editor.pageToShape(only, page))
				: false;
		const leaf = editor.getShapeAtPoint(page) ?? (inside ? only : undefined);
		if (!leaf) return;
		const hit = editor.getSelectable(leaf);
		if (editor.util(hit.kind).group) {
			editor.focusedGroup.set(hit.id);
			editor.select([editor.getSelectable(leaf).id]);
			return;
		}
		editor.startEditing(hit.id);
	}

	override onKeyDown(event: KeyInfo) {
		const { editor } = this;
		const step = event.shift ? 10 : 1;
		switch (event.key) {
			case 'Enter': {
				const selection = editor.selection.peek();
				if (selection.length === 1) editor.startEditing(selection[0]);
				return;
			}
			case 'Delete':
			case 'Backspace':
				return editor.deleteSelection();
			case 'ArrowLeft':
				return editor.nudgeSelection(-step, 0);
			case 'ArrowRight':
				return editor.nudgeSelection(step, 0);
			case 'ArrowUp':
				return editor.nudgeSelection(0, -step);
			case 'ArrowDown':
				return editor.nudgeSelection(0, step);
			case 'a':
				if (event.meta) editor.selectAll();
				return;
			case 'd':
				if (event.meta) editor.duplicateSelection();
				return;
			case 'g':
			case 'G':
				if (!event.meta) return;
				return event.shift ? editor.ungroupSelection() : editor.groupSelection();
			case ']':
				return event.alt ? editor.bringForward() : editor.bringToFront();
			case '[':
				return event.alt ? editor.sendBackward() : editor.sendToBack();
		}
	}

	/** Escape steps out of a group first, then lets go of the selection. */
	override onCancel() {
		const { editor } = this;
		const focus = editor.focusedGroup.peek();
		editor.focusedGroup.set(null);
		editor.select(focus ? [focus] : []);
	}
}
