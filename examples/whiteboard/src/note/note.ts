/*
 * A plugin written outside the package, the way an app would: a sticky note. One shape util,
 * one tool (the box tool, pointed at the note), one view, one toolbar entry.
 */

import NoteBlank from 'phosphor-svelte/lib/NoteBlank';
import { BoxTool, seededRandom, ShapeUtil, type Box, type ShapeRecord } from '@klementine/draw';
import type { DrawSveltePlugin } from '@klementine/draw/svelte';
import NoteView from './note-view.svelte';

export type NoteShape = ShapeRecord<'note', { w: number; h: number; text: string }>;

/**
 * A note's tilt in degrees: 1 to 3, to the left or to the right. It comes from the note's id,
 * so a note keeps its tilt and looks the same on every screen.
 */
export function noteTilt(id: string): number {
	const random = seededRandom(id);
	const direction = random() < 0.5 ? -1 : 1;
	return direction * (1 + random() * 2);
}

class NoteShapeUtil extends ShapeUtil<NoteShape> {
	static override kind = 'note';
	override readonly styles = ['color', 'opacity'] as const;

	defaultProps() {
		return { w: 180, h: 180, text: '' };
	}

	bounds(shape: NoteShape): Box {
		return { x: 0, y: 0, w: shape.props.w, h: shape.props.h };
	}

	/** The outline tilts with the picture, so hover and selection trace the note as it is seen. */
	override outline(shape: NoteShape): string {
		const { w, h } = shape.props;
		const angle = (noteTilt(shape.id) * Math.PI) / 180;
		const cos = Math.cos(angle);
		const sin = Math.sin(angle);
		const corner = (x: number, y: number) => {
			const dx = x - w / 2;
			const dy = y - h / 2;
			return `${w / 2 + dx * cos - dy * sin},${h / 2 + dx * sin + dy * cos}`;
		};
		return `M${corner(0, 0)}L${corner(w, 0)}L${corner(w, h)}L${corner(0, h)}Z`;
	}

	override canEdit() {
		return true;
	}

	resize(shape: NoteShape, target: Box) {
		return {
			x: target.x,
			y: target.y,
			props: { ...shape.props, w: Math.max(60, target.w), h: Math.max(60, target.h) }
		};
	}
}

class NoteTool extends BoxTool {
	static override id = 'note';
	shape = { kind: 'note', style: { color: 'ink' as const } };
	// A new note is typed into straight away.
	override edit = true;
}

export const notePlugin: DrawSveltePlugin = {
	name: 'note',
	shapes: [NoteShapeUtil],
	tools: [NoteTool],
	shortcuts: { n: 'note' },
	views: { note: NoteView },
	toolbar: [{ tool: 'note', label: 'Note', icon: NoteBlank, shortcut: 'N' }]
};
