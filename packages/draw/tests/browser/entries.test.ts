/*
 * The package's two entries (`pnpm test:browser`): the main one, which is the Svelte layer with
 * the whole engine, and `core`, the engine alone. What is promised here is what an app's
 * imports rest on.
 */

import { expect, test } from 'vitest';
import * as main from '../../src/lib/index.ts';
import * as core from '../../src/lib/core.ts';

test('the main entry has everything the engine entry has', () => {
	const missing = Object.keys(core).filter((name) => !(name in main));
	expect(missing).toEqual([]);
	// One engine, not a copy of it: a class from either entry is the same class.
	expect(main.Editor).toBe(core.Editor);
	expect(main.ShapeUtil).toBe(core.ShapeUtil);
	expect(main.StateNode).toBe(core.StateNode);
});

test('from the main entry, a built-in plugin is the one the canvas uses', () => {
	const exported = main as unknown as Record<string, unknown>;
	for (const plugin of main.defaultPlugins) {
		// Under its own name (`geoPlugin` for `geo`), never the engine's plugin of that name.
		expect(exported[`${plugin.name}Plugin`], `${plugin.name}Plugin`).toBe(plugin);
	}
	// Which is what gives a shape its view.
	expect(main.geoPlugin.views?.geo).toBeTruthy();
	expect(main.geoPlugin).not.toBe(core.geoPlugin);
	expect('views' in core.geoPlugin).toBe(false);
});

test('what needs Svelte is only in the main entry', () => {
	const svelteOnly = ['Canvas', 'Minimap', 'defaultPlugins', 'editText', 'toPng', 'deepLink'];
	expect(svelteOnly.filter((name) => name in core)).toEqual([]);
	expect(svelteOnly.filter((name) => !(name in main))).toEqual([]);
});
