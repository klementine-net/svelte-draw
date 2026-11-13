/*
 * The asset store an editor has when the app gives it none: a file stays in the document
 * itself, as a data URL. Needs a browser (`FileReader`).
 */

import type { AssetStore } from '../core/editor/types.ts';

export const inlineAssets: AssetStore = {
	upload: (file) =>
		new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(String(reader.result));
			reader.onerror = () => reject(reader.error);
			reader.readAsDataURL(file);
		})
};
