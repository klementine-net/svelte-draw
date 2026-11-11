/*
 * The record store: the one place a document lives. Every write goes through here, is grouped
 * into a diff and announced with its source (`user` for this editor, `remote` for a
 * collaborator). Undo, persistence and sync are all listeners on that one stream.
 */

import { Atom, atom } from './signal.ts';
import type { BaseRecord, DrawRecord } from './records.ts';

export interface Diff<R extends BaseRecord = DrawRecord> {
	added: Record<string, R>;
	/** `[from, to]` for every record that changed. */
	updated: Record<string, [R, R]>;
	removed: Record<string, R>;
}

/** Who made a change: this editor's user, or someone else through sync. */
export type ChangeSource = 'user' | 'remote';

export type StoreListener<R extends BaseRecord> = (diff: Diff<R>, source: ChangeSource) => void;

export function emptyDiff<R extends BaseRecord>(): Diff<R> {
	return { added: {}, updated: {}, removed: {} };
}

export function isEmptyDiff(diff: Diff<BaseRecord>): boolean {
	for (const _ in diff.added) return false;
	for (const _ in diff.updated) return false;
	for (const _ in diff.removed) return false;
	return true;
}

/** The diff that takes the document back to where `diff` started. */
export function invertDiff<R extends BaseRecord>(diff: Diff<R>): Diff<R> {
	const updated: Diff<R>['updated'] = {};
	for (const [id, [from, to]] of Object.entries(diff.updated)) updated[id] = [to, from];
	return { added: { ...diff.removed }, updated, removed: { ...diff.added } };
}

/** Folds `next` (which happened after `into`) into `into`, so the pair reads as one diff. */
export function mergeDiff<R extends BaseRecord>(into: Diff<R>, next: Diff<R>) {
	for (const [id, record] of Object.entries(next.added)) {
		const removed = into.removed[id];
		if (removed) {
			delete into.removed[id];
			if (removed !== record) into.updated[id] = [removed, record];
		} else {
			into.added[id] = record;
		}
	}
	for (const [id, [from, to]] of Object.entries(next.updated)) {
		if (into.added[id]) into.added[id] = to;
		else if (into.updated[id]) into.updated[id] = [into.updated[id][0], to];
		else into.updated[id] = [from, to];
	}
	for (const [id, record] of Object.entries(next.removed)) {
		if (into.added[id]) {
			delete into.added[id];
		} else if (into.updated[id]) {
			into.removed[id] = into.updated[id][0];
			delete into.updated[id];
		} else {
			into.removed[id] = record;
		}
	}
}

export class Store<R extends BaseRecord = DrawRecord> {
	#records = new Map<string, Atom<R>>();
	/** Bumped whenever a record is added or removed, so list reads can track membership. */
	#membership = atom(0);
	#listeners = new Set<StoreListener<R>>();
	#pending: Diff<R> | null = null;
	#membershipChanged = false;

	constructor(records: R[] = []) {
		for (const record of records) this.#records.set(record.id, atom(record));
	}

	/** One record, or undefined. Tracked: the reader re-runs when this record changes. */
	get(id: string): R | undefined {
		const found = this.#records.get(id);
		if (found) return found.get();
		this.#membership.get();
		return undefined;
	}

	has(id: string): boolean {
		this.#membership.get();
		return this.#records.has(id);
	}

	/** Every record. Tracked on membership and on each record. */
	all(): R[] {
		this.#membership.get();
		return [...this.#records.values()].map((record) => record.get());
	}

	/** Adds the records, or replaces the ones that exist. */
	put(records: R[], source: ChangeSource = 'user') {
		this.transact(() => {
			for (const record of records) {
				const existing = this.#records.get(record.id);
				if (existing) {
					const from = existing.peek();
					if (from === record) continue;
					existing.set(record);
					mergeDiff(this.#pending!, {
						added: {},
						updated: { [record.id]: [from, record] },
						removed: {}
					});
				} else {
					this.#records.set(record.id, atom(record));
					this.#membershipChanged = true;
					mergeDiff(this.#pending!, { added: { [record.id]: record }, updated: {}, removed: {} });
				}
			}
		}, source);
	}

	remove(ids: string[], source: ChangeSource = 'user') {
		this.transact(() => {
			for (const id of ids) {
				const existing = this.#records.get(id);
				if (!existing) continue;
				this.#records.delete(id);
				this.#membershipChanged = true;
				mergeDiff(this.#pending!, { added: {}, updated: {}, removed: { [id]: existing.peek() } });
			}
		}, source);
	}

	/**
	 * Runs `fn` as one change: every write inside lands in one diff, announced once at the end.
	 * A nested call joins the outer one (and its source).
	 */
	transact(fn: () => void, source: ChangeSource = 'user') {
		if (this.#pending) return fn();
		const diff = (this.#pending = emptyDiff<R>());
		try {
			fn();
		} finally {
			this.#pending = null;
			if (this.#membershipChanged) {
				this.#membershipChanged = false;
				this.#membership.update((n) => n + 1);
			}
			if (!isEmptyDiff(diff)) for (const listener of [...this.#listeners]) listener(diff, source);
		}
	}

	/** Applies a diff from elsewhere (an undo step, or a collaborator's change). */
	applyDiff(diff: Diff<R>, source: ChangeSource) {
		this.transact(() => {
			this.remove(Object.keys(diff.removed), source);
			this.put(Object.values(diff.added), source);
			this.put(
				Object.values(diff.updated).map(([, to]) => to),
				source
			);
		}, source);
	}

	/** Calls `listener` after every change; returns the function that stops it. */
	listen(listener: StoreListener<R>): () => void {
		this.#listeners.add(listener);
		return () => this.#listeners.delete(listener);
	}

	/** Every record as plain data, to save or to hand to another store. */
	snapshot(): R[] {
		return [...this.#records.values()].map((record) => record.peek());
	}
}
