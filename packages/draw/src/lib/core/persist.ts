/*
 * Keeping a document and keeping tabs in step. Both hang on the store's diff stream, the same
 * seam a server sync would use:
 *
 *   storage   every change this user makes is written record by record (never the whole
 *             document, so two tabs do not overwrite each other's work)
 *   channel   every change this user makes is posted to the other tabs, which apply it as a
 *             remote change (not in their undo history)
 *
 * The parts that touch the browser (`indexedDbStorage`, `broadcastChannel`) are thin shells
 * around these two interfaces, so the logic here runs in a test with stand-ins.
 */

import { SCHEMA_VERSION, type DrawRecord } from './records.ts';
import type { Diff } from './store.ts';
import type { Editor, Peer } from './editor.ts';

export interface SavedDocument {
	version: number;
	records: DrawRecord[];
}

/** Where a document is kept. */
export interface DocumentStorage {
	/** What is kept, or undefined when nothing was saved yet. */
	load(): Promise<SavedDocument | undefined>;
	/** Writes and removes single records. */
	save(change: { version: number; put: DrawRecord[]; remove: string[] }): Promise<void>;
}

/** A line to the other tabs (or peers) showing the same document. */
export interface Channel {
	post(message: ChannelMessage): void;
	/** Calls `listener` for every message from elsewhere; returns the function that stops it. */
	listen(listener: (message: ChannelMessage) => void): () => void;
	close?(): void;
}

export type ChannelMessage =
	| { type: 'diff'; diff: Diff<DrawRecord> }
	/** Where someone is and what they have picked; sent as they move. */
	| { type: 'presence'; peer: Peer }
	| { type: 'leave'; id: string };

/** How long (ms) someone is shown after their last sign of life. */
const PEER_TIMEOUT = 8000;
const PEER_COLORS = ['#e5484d', '#3e63dd', '#30a46c', '#8e4ec6', '#0090ff', '#d6409f', '#12a594'];

/**
 * Brings records saved by an older version up to this one. There is only one version so far;
 * a change to the record shapes adds its step here, and `SCHEMA_VERSION` goes up.
 */
export function migrate(saved: SavedDocument): DrawRecord[] {
	if (saved.version > SCHEMA_VERSION)
		console.warn(
			`This document was saved by a newer version (${saved.version}) than this one reads (${SCHEMA_VERSION}).`
		);
	return validRecords(saved.records);
}

/**
 * The records that have the shape a record must have. What does not (a damaged file, another
 * program's JSON) is left out, so one bad record cannot break the canvas.
 */
export function validRecords(records: unknown): DrawRecord[] {
	if (!Array.isArray(records)) return [];
	const text = (value: unknown) => typeof value === 'string' && value !== '';
	const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value);
	const object = (value: unknown): value is Record<string, unknown> =>
		typeof value === 'object' && value !== null;
	return records.filter((record): record is DrawRecord => {
		if (!object(record) || !text(record.id)) return false;
		if (record.type === 'page') return text(record.name) && text(record.index);
		if (record.type === 'asset') return text(record.src) && number(record.w) && number(record.h);
		if (record.type === 'shape')
			return (
				text(record.kind) &&
				text(record.parentId) &&
				text(record.index) &&
				number(record.x) &&
				number(record.y) &&
				object(record.style) &&
				object(record.props)
			);
		return false;
	});
}

export interface PersistOptions {
	storage?: DocumentStorage;
	channel?: Channel;
	/** Fills a document that was never saved (a first picture). Not an undo step. */
	seed?: (editor: Editor) => void;
	/** How this user shows to the others on the channel. A guest with a colour by default. */
	user?: { name?: string; color?: string };
	/**
	 * How long (ms) changes are gathered before they are written to storage. 0 writes each
	 * change at once; a drag makes a change per pointer move, so a browser wants a few hundred.
	 */
	saveDelay?: number;
}

/**
 * Loads the editor's document from `storage`, then keeps storage and the other tabs up to
 * date with what this user changes, and this editor up to date with what they change.
 * Resolves, once the document is loaded, with the function that stops it.
 */
export async function persist(editor: Editor, options: PersistOptions): Promise<() => void> {
	const { storage, channel } = options;
	const saved = await storage?.load();
	if (saved && saved.records.length > 0) editor.loadDocument(migrate(saved));
	else {
		options.seed?.(editor);
		editor.history.clear();
		// The first save: everything, once.
		await storage?.save({ version: SCHEMA_VERSION, put: editor.store.snapshot(), remove: [] });
	}

	// What waits to be written: the latest state of each changed record, or its removal.
	const put = new Map<string, DrawRecord>();
	const remove = new Set<string>();
	let timer: ReturnType<typeof setTimeout> | undefined;
	const flush = () => {
		clearTimeout(timer);
		timer = undefined;
		if (put.size === 0 && remove.size === 0) return;
		void storage?.save({ version: SCHEMA_VERSION, put: [...put.values()], remove: [...remove] });
		put.clear();
		remove.clear();
	};
	// Only now: a listener attached before the load would have saved the empty board over it.
	const stopSaving = editor.store.listen((diff, source) => {
		if (source !== 'user') return;
		channel?.post({ type: 'diff', diff });
		if (!storage) return;
		for (const id of Object.keys(diff.removed)) {
			put.delete(id);
			remove.add(id);
		}
		// After the removals: a record that was replaced (a file opened over the board) stays.
		for (const record of [
			...Object.values(diff.added),
			...Object.values(diff.updated).map(([, to]) => to)
		]) {
			remove.delete(record.id);
			put.set(record.id, record);
		}
		if (!options.saveDelay) flush();
		else timer ??= setTimeout(flush, options.saveDelay);
	});
	// A tab that is closed writes what it still holds.
	const page = globalThis as {
		addEventListener?: Window['addEventListener'];
		removeEventListener?: Window['removeEventListener'];
	};
	page.addEventListener?.('pagehide', flush);
	const stopPresence = channel ? presence(editor, channel, options.user ?? {}) : undefined;
	const stopListening = channel?.listen((message) => {
		if (message.type === 'diff') editor.store.applyDiff(message.diff, 'remote');
	});

	return () => {
		stopSaving();
		flush();
		page.removeEventListener?.('pagehide', flush);
		stopPresence?.();
		stopListening?.();
		channel?.close?.();
	};
}

/**
 * Tells the channel where this user is and what they have picked, and keeps `editor.peers`:
 * everyone heard from lately. Nothing of this is in the document.
 */
export function presence(
	editor: Editor,
	channel: Channel,
	user: { name?: string; color?: string }
): () => void {
	const id = Math.random().toString(36).slice(2, 10);
	const color =
		user.color ??
		PEER_COLORS[[...id].reduce((sum, c) => sum + c.charCodeAt(0), 0) % PEER_COLORS.length];
	const seen = new Map<string, { peer: Peer; at: number }>();
	const publish = () => editor.peers.set([...seen.values()].map(({ peer }) => peer));

	const me = (): Peer => ({
		id,
		name: user.name ?? 'Guest',
		color,
		pageId: editor.pageId.peek(),
		cursor: editor.pointerPage.peek(),
		selection: editor.selection.peek(),
		laser: editor.laser.peek()
	});
	// At most one message per frame's worth of time, always ending with the latest state.
	let waiting: ReturnType<typeof setTimeout> | undefined;
	const announce = () => {
		if (waiting !== undefined) return;
		waiting = setTimeout(() => {
			waiting = undefined;
			channel.post({ type: 'presence', peer: me() });
		}, 30);
	};
	const stops = [
		editor.pointerPage.listen(announce),
		editor.selection.listen(announce),
		editor.pageId.listen(announce),
		editor.laser.listen(announce),
		channel.listen((message) => {
			if (message.type === 'presence') {
				// Someone new: let them know this user is here too.
				if (!seen.has(message.peer.id)) announce();
				seen.set(message.peer.id, { peer: message.peer, at: Date.now() });
				publish();
			} else if (message.type === 'leave' && seen.delete(message.id)) publish();
		})
	];
	// Whoever went quiet without saying goodbye (a closed laptop) fades after a while.
	const sweep = setInterval(() => {
		const before = seen.size;
		for (const [peer, { at }] of seen) if (Date.now() - at > PEER_TIMEOUT) seen.delete(peer);
		if (seen.size !== before) publish();
		else if (seen.size > 0) channel.post({ type: 'presence', peer: me() });
	}, PEER_TIMEOUT / 2);
	(sweep as { unref?: () => void }).unref?.();
	announce();
	// A tab that is closed says goodbye, so its pointer does not linger on the others' screens.
	const leave = () => channel.post({ type: 'leave', id });
	const page = globalThis as { addEventListener?: Window['addEventListener'] } & {
		removeEventListener?: Window['removeEventListener'];
	};
	page.addEventListener?.('pagehide', leave);

	return () => {
		for (const stop of stops) stop();
		clearInterval(sweep);
		if (waiting !== undefined) clearTimeout(waiting);
		page.removeEventListener?.('pagehide', leave);
		leave();
		editor.peers.set([]);
	};
}

/** A document kept in the browser's IndexedDB under `key`. Browser only. */
export function indexedDbStorage(key: string): DocumentStorage {
	// One connection, opened at the first use and kept.
	let connection: Promise<IDBDatabase> | undefined;
	const open = () =>
		(connection ??= new Promise<IDBDatabase>((resolve, reject) => {
			const request = indexedDB.open(`klementine-draw:${key}`, 1);
			request.onupgradeneeded = () => {
				request.result.createObjectStore('records', { keyPath: 'id' });
				request.result.createObjectStore('meta');
			};
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		}));
	const done = (transaction: IDBTransaction) =>
		new Promise<void>((resolve, reject) => {
			transaction.oncomplete = () => resolve();
			transaction.onerror = () => reject(transaction.error);
			transaction.onabort = () => reject(transaction.error);
		});
	const result = <T>(request: IDBRequest<T>) =>
		new Promise<T>((resolve, reject) => {
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});

	return {
		async load() {
			const db = await open();
			const transaction = db.transaction(['records', 'meta'], 'readonly');
			const records = await result<DrawRecord[]>(transaction.objectStore('records').getAll());
			const version = await result<number | undefined>(
				transaction.objectStore('meta').get('version')
			);
			return records.length > 0 ? { version: version ?? 1, records } : undefined;
		},
		async save({ version, put, remove }) {
			const db = await open();
			const transaction = db.transaction(['records', 'meta'], 'readwrite');
			const records = transaction.objectStore('records');
			for (const record of put) records.put(record);
			for (const id of remove) records.delete(id);
			transaction.objectStore('meta').put(version, 'version');
			await done(transaction);
		}
	};
}

/** A line to the other tabs of this browser that show the document `key`. Browser only. */
export function broadcastChannel(key: string): Channel {
	const channel = new BroadcastChannel(`klementine-draw:${key}`);
	return {
		post: (message) => channel.postMessage(message),
		listen(listener) {
			const onmessage = (event: MessageEvent) => listener(event.data as ChannelMessage);
			channel.addEventListener('message', onmessage);
			return () => channel.removeEventListener('message', onmessage);
		},
		close: () => channel.close()
	};
}
