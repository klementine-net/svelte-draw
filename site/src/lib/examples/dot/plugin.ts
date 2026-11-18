import type { DrawSveltePlugin } from '@klementine/draw/svelte';
import { DotTool, DotUtil } from './dot.ts';
import DotIcon from './dot-icon.svelte';
import DotView from './dot-view.svelte';

/** The kind, its tool, the key, the view, the place in the toolbar. */
export const dotPlugin: DrawSveltePlugin = {
	name: 'dot',
	shapes: [DotUtil],
	tools: [DotTool],
	shortcuts: { b: 'dot' },
	views: { dot: DotView },
	toolbar: [{ tool: 'dot', label: 'Vote', icon: DotIcon, shortcut: 'B' }]
};
