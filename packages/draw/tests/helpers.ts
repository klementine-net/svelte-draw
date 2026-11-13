/* What the tests share: an editor to try things on, a hand that drags, stand-ins for storage. */

import assert from 'node:assert/strict';
import {
	corePlugins,
	Editor,
	pointer,
	Store,
	type Channel,
	type ChannelMessage,
	type DocumentStorage,
	type DrawPlugin,
	type DrawRecord
} from '../src/lib/index.ts';

export function makeEditor(plugins: DrawPlugin[] = corePlugins, store?: Store<DrawRecord>) {
	const editor = new Editor({ plugins, store });
	editor.viewport.set({ w: 1000, h: 800 });
	return editor;
}

/** Press at `from`, move to `to` in a few steps, release. */
export function drag(editor: Editor, from: [number, number], to: [number, number], options = {}) {
	editor.dispatch(pointer('down', { x: from[0], y: from[1] }, options));
	for (let i = 1; i <= 4; i++) {
		const t = i / 4;
		editor.dispatch(
			pointer(
				'move',
				{ x: from[0] + (to[0] - from[0]) * t, y: from[1] + (to[1] - from[1]) * t },
				options
			)
		);
	}
	editor.dispatch(pointer('up', { x: to[0], y: to[1] }, options));
}

export const key = (k: string, options = {}) =>
	({
		type: 'key',
		name: 'down',
		key: k,
		repeat: false,
		shift: false,
		alt: false,
		meta: false,
		...options
	}) as const;

export const byId = (x: DrawRecord, y: DrawRecord) => (x.id < y.id ? -1 : 1);

export const near = (actual: number, expected: number, slack = 0.01) =>
	assert.ok(Math.abs(actual - expected) <= slack, `${actual} is not ${expected}`);

export const solid = { fill: 'solid' } as const;

export const rect = (editor: Editor, x: number, y: number, w = 100, h = 100) =>
	editor.createShape({ kind: 'geo', x, y, props: { w, h }, style: solid });

export const click = (editor: Editor, x: number, y: number, options = {}) => {
	editor.dispatch(pointer('down', { x, y }, options));
	editor.dispatch(pointer('up', { x, y }, options));
};

/** Storage and a pair of channels that live in memory, standing in for IndexedDB and tabs. */
export function fakeStorage() {
	const records = new Map<string, DrawRecord>();
	let version: number | undefined;
	const storage: DocumentStorage = {
		load: async () =>
			records.size > 0 ? { version: version ?? 1, records: [...records.values()] } : undefined,
		save: async (change) => {
			version = change.version;
			for (const record of change.put) records.set(record.id, record);
			for (const id of change.remove) records.delete(id);
		}
	};
	return { storage, records };
}

export function fakeChannels(): [Channel, Channel] {
	const listeners: ((message: ChannelMessage) => void)[][] = [[], []];
	const end = (mine: number): Channel => ({
		// A message goes to the other end, never back to the sender.
		post: (message) =>
			listeners[1 - mine].forEach((listener) => listener(structuredClone(message))),
		listen(listener) {
			listeners[mine].push(listener);
			return () => listeners[mine].splice(listeners[mine].indexOf(listener), 1);
		}
	});
	return [end(0), end(1)];
}
