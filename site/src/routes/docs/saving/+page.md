## A board in the browser

`<Draw persistenceKey="my-board" />` is all it takes. Behind it is one function you can call
yourself:

```ts
import { broadcastChannel, indexedDbStorage, persist } from '@klementine/draw';

const stop = await persist(editor, {
	storage: indexedDbStorage('my-board'),
	channel: broadcastChannel('my-board'),
	seed: (editor) => editor.createShape({ kind: 'note', x: 0, y: 0 })
});
```

It loads what was saved (or runs `seed` on an empty board), then writes every change this user
makes, record by record, and posts it to the other tabs, which apply it as a change from
elsewhere. Storage that fails or never answers does not stop the board: it goes on unsaved.

## Your own storage, your own server

`persist` works with two small interfaces. IndexedDB and the channel between tabs are the ones
built; a server is two more.

```ts
interface DocumentStorage {
	load(): Promise<{ version: number; records: DrawRecord[] } | undefined>;
	save(change: { version: number; put: DrawRecord[]; remove: string[] }): Promise<void>;
}

interface Channel {
	post(message: ChannelMessage): void;
	listen(listener: (message: ChannelMessage) => void): () => void;
}
```

Records are whole documents keyed by id: one row per record, last write wins per record, and
the stacking order is a fractional index, so two people can reorder at once. **No server side
is written yet.** One thing a server sync has to decide: a diff carries whole records, so two
people changing the same shape in the same moment overwrite each other's fields.

## Other people

The channel also carries who else is there: their pointer, what they picked and their laser
pointer, never written to the document. They are in `editor.peers`, and the canvas draws them.
`<Draw user={{ name: 'Ada' }} />` names this user for the others.

## Pictures and files

An image is two records: the shape, and an asset with the file. Moving the picture never sends
the file again. By default the file stays in the document as a data URL, so it is saved and
shared with the rest and needs no server. To keep files elsewhere, give the editor an `upload`
that stores the file and answers its link:

```ts
const editor = new Editor({
	plugins: defaultPlugins,
	assets: { upload: async (file) => await myBucket.put(file) }
});
```

## Files and pictures out

The page menu saves the board to a file and opens one again, and saves the page or the
selection as a PNG. In code:

```ts
import { openFile, saveFile, toPng, toSvg } from '@klementine/draw/svelte';

const document = editor.getDocument(); // { version, records }
editor.loadDocument(document.records, 'user');
const png = await toPng(editor, canvasElement, { ids: editor.selection.peek() });
```

A picture is made from what is on the screen, so it looks exactly like the canvas, fonts
included. A picture loaded from another website can be missing from it.

## Documents from older versions

Every saved document carries the version of the record shapes it was written with, and records
that do not have the shape a record must have are left out when it loads. When the record shapes
change, `migrate` is where the step from the old shape to the new one goes.
