/*
 * The smallest reactive unit of the core: a value that can be read, written and listened to.
 * The core never imports a UI framework; a renderer hooks in with `setTracker`, which is called
 * on every tracked read so the renderer can subscribe whatever is reading right now (the Svelte
 * layer does it with `createSubscriber`, see svelte/reactive.ts).
 */

export type Tracker = (atom: Atom<unknown>) => void;

let tracker: Tracker | null = null;

/** Installs the renderer's read hook. One renderer per page; the last call wins. */
export function setTracker(next: Tracker | null) {
	tracker = next;
}

export class Atom<T> {
	#value: T;
	#listeners = new Set<() => void>();

	constructor(value: T) {
		this.#value = value;
	}

	/** Reads the value and tells the renderer about the read. */
	get(): T {
		tracker?.(this as Atom<unknown>);
		return this.#value;
	}

	/** Reads the value without tracking (for event handlers and tests). */
	peek(): T {
		return this.#value;
	}

	set(value: T) {
		if (Object.is(value, this.#value)) return;
		this.#value = value;
		for (const listener of [...this.#listeners]) listener();
	}

	update(fn: (value: T) => T) {
		this.set(fn(this.#value));
	}

	/** Calls `listener` after every change; returns the function that stops it. */
	listen(listener: () => void): () => void {
		this.#listeners.add(listener);
		return () => this.#listeners.delete(listener);
	}
}

export function atom<T>(value: T): Atom<T> {
	return new Atom(value);
}
