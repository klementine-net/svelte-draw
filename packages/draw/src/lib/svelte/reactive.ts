/*
 * The bridge from the core's atoms to Svelte. The core calls the tracker on every tracked read;
 * here that read subscribes whatever is running right now (a template, a $derived, an $effect)
 * to the atom, through `createSubscriber`. Outside an effect the call does nothing. The result:
 * `editor.camera.get()` in a template is reactive, with no stores and no wrappers.
 */

import { createSubscriber } from 'svelte/reactivity';
import { setTracker, type Atom } from '../core.ts';

const subscribers = new WeakMap<Atom<unknown>, () => void>();

setTracker((atom) => {
	let subscribe = subscribers.get(atom);
	if (!subscribe) {
		subscribe = createSubscriber((update) => atom.listen(update));
		subscribers.set(atom, subscribe);
	}
	subscribe();
});
