import type { Editor } from '@klementine/draw';

/** Reads the whole document: plain records, ready to save or send. */
export default function run(editor: Editor) {
	const { records } = editor.getDocument();
	const shapes = records.filter((record) => record.type === 'shape');
	return `${records.length} records, ${shapes.length} of them shapes.`;
}
