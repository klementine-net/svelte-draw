/*
 * Undo and redo, built on the store's diff stream. Every `user` change is folded into the open
 * step; `mark()` closes the step, so the next change starts a new one. A tool marks once before
 * an interaction (a drag, a stroke), and the whole interaction undoes as one.
 *
 * Remote changes are never recorded: undo only takes back what this user did.
 */

import { atom } from './signal.ts';
import type { BaseRecord } from './records.ts';
import { emptyDiff, invertDiff, mergeDiff, type Diff, type Store } from './store.ts';

export class History<R extends BaseRecord> {
	#store: Store<R>;
	#undos: Diff<R>[] = [];
	#redos: Diff<R>[] = [];
	/** True while the top undo step still takes changes. */
	#open = false;
	#applying = false;

	readonly canUndo = atom(false);
	readonly canRedo = atom(false);

	constructor(store: Store<R>) {
		this.#store = store;
		store.listen((diff, source) => {
			if (source !== 'user' || this.#applying) return;
			if (this.#open) {
				mergeDiff(this.#undos[this.#undos.length - 1], diff);
			} else {
				const step = emptyDiff<R>();
				mergeDiff(step, diff);
				this.#undos.push(step);
				this.#open = true;
			}
			this.#redos = [];
			this.#sync();
		});
	}

	/** Closes the open step: what follows undoes separately from what came before. */
	mark() {
		this.#open = false;
	}

	undo() {
		const step = this.#undos.pop();
		if (!step) return;
		this.#open = false;
		this.#apply(invertDiff(step));
		this.#redos.push(step);
		this.#sync();
	}

	redo() {
		const step = this.#redos.pop();
		if (!step) return;
		this.#open = false;
		this.#apply(step);
		this.#undos.push(step);
		this.#sync();
	}

	/** Takes back the open step and forgets it (a cancelled drag): no redo for it. */
	bail() {
		if (!this.#open) return;
		const step = this.#undos.pop();
		this.#open = false;
		if (step) this.#apply(invertDiff(step));
		this.#sync();
	}

	/** Forgets every step (after loading a document: what was loaded is not undoable). */
	clear() {
		this.#undos = [];
		this.#redos = [];
		this.#open = false;
		this.#sync();
	}

	#apply(diff: Diff<R>) {
		this.#applying = true;
		try {
			this.#store.applyDiff(diff, 'user');
		} finally {
			this.#applying = false;
		}
	}

	#sync() {
		this.canUndo.set(this.#undos.length > 0);
		this.canRedo.set(this.#redos.length > 0);
	}
}
