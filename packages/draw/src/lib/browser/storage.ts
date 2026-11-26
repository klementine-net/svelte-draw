/* A document kept in the browser's IndexedDB: the `DocumentStorage` a browser app uses. */

import type { DrawRecord } from '../core/records.ts';
import type { DocumentStorage } from '../core/persist.ts';

/** A document kept in the browser's IndexedDB under `key`. */
export function indexedDbStorage(key: string): DocumentStorage {
	// One connection, opened at the first use and kept.
	let connection: Promise<IDBDatabase> | undefined;
	const open = () =>
		(connection ??= new Promise<IDBDatabase>((resolve, reject) => {
			const request = indexedDB.open(`svelte-draw:${key}`, 1);
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
