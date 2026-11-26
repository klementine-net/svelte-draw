/* A line between the tabs of one browser: the `Channel` a browser app uses. */

import type { Channel, ChannelMessage } from '../core/persist.ts';

/** A line to the other tabs of this browser that show the document `key`. */
export function broadcastChannel(key: string): Channel {
	const channel = new BroadcastChannel(`svelte-draw:${key}`);
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
