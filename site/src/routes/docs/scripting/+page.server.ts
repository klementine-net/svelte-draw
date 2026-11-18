import { highlight, source } from '#lib/server/highlight.ts';

// The examples on the page, highlighted at build time from the very files the page runs.
const files = ['add', 'move', 'arrange', 'read', 'undo'] as const;

export async function load() {
	const code = Object.fromEntries(
		await Promise.all(
			files.map(async (name) => [name, await highlight(source(`scripts/${name}.ts`), 'ts')])
		)
	) as Record<(typeof files)[number], string>;
	return { code };
}
