/*
 * The API reference, read from the library's source at build time: the methods of `Editor`,
 * `ShapeUtil` and `StateNode` with their documentation comments, and the components with the
 * comment at the top of each. So the reference cannot drift from the code: it is the code.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { highlight } from '#lib/server/highlight.ts';

const lib = resolve(process.cwd(), '../packages/draw/src/lib');

export interface Member {
	name: string;
	/** The signature, highlighted. */
	signature: string;
	/** The documentation comment, as paragraphs of HTML (`code` in backticks marked up). */
	doc: string[];
}

export interface Group {
	title: string;
	members: Member[];
}

/** Plain text as HTML, with what is in backticks as code. */
function inline(text: string): string {
	const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	return escaped.replace(/`([^`]+)`/g, '<code>$1</code>');
}

/** A documentation comment's text: paragraphs, without the `*` and without `@example` and on. */
function docOf(node: ts.Node, text: string): string[] {
	const ranges = ts.getLeadingCommentRanges(text, node.getFullStart()) ?? [];
	const doc = ranges
		.map((range) => text.slice(range.pos, range.end))
		.filter((comment) => comment.startsWith('/**'))
		.at(-1);
	if (!doc) return [];
	const body = doc
		.replace(/^\/\*\*/, '')
		.replace(/\*\/$/, '')
		.split('\n')
		.map((line) => line.replace(/^\s*\* ?/, ''))
		.join('\n')
		.split(/\n\s*@\w+/)[0]
		.trim();
	return body
		.split(/\n\s*\n/)
		.map((paragraph) => inline(paragraph.replace(/\s*\n\s*/g, ' ').trim()))
		.filter(Boolean);
}

/** The section a member sits in: the nearest `// ── Name ──` comment above it. */
function sectionOf(node: ts.Node, text: string): string | undefined {
	const ranges = ts.getLeadingCommentRanges(text, node.getFullStart()) ?? [];
	for (const range of ranges) {
		const match = /\/\/ ── ([^─]+?) ─/.exec(text.slice(range.pos, range.end));
		if (match) return match[1].trim();
	}
	return undefined;
}

function isPublic(member: ts.ClassElement): boolean {
	if (!member.name || ts.isPrivateIdentifier(member.name)) return false;
	if (ts.isConstructorDeclaration(member)) return false;
	const flags = ts.getCombinedModifierFlags(member as ts.Declaration);
	return !(flags & ts.ModifierFlags.Private) && !(flags & ts.ModifierFlags.Protected);
}

/** The members of `className` in `file`, grouped by section (or all in one group). */
async function classMembers(file: string, className: string, single?: string): Promise<Group[]> {
	const text = readFileSync(resolve(lib, file), 'utf8');
	const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
	const declaration = source.statements.find(
		(statement): statement is ts.ClassDeclaration =>
			ts.isClassDeclaration(statement) && statement.name?.text === className
	);
	if (!declaration) throw new Error(`No class ${className} in ${file}`);
	const groups: Group[] = [];
	let group: Group = { title: single ?? 'State', members: [] };
	groups.push(group);
	for (const member of declaration.members) {
		const section = sectionOf(member, text);
		if (section && !single) {
			group = { title: section, members: [] };
			groups.push(group);
		}
		if (!isPublic(member)) continue;
		const name = member.name!.getText(source);
		const start = member.getStart(source);
		let end = member.end;
		if ((ts.isMethodDeclaration(member) || ts.isGetAccessor(member)) && member.body)
			end = member.body.getStart(source);
		const signature = text
			.slice(start, end)
			.replace(/\s*\n\s*/g, ' ')
			.replace(/\(\s+/g, '(')
			.replace(/\s+\)/g, ')')
			.replace(/,\s*\)/g, ')')
			.replace(/[;{\s]+$/, '')
			.replace(/^(?:override |abstract )+/, '');
		group.members.push({
			name,
			signature: await highlight(signature, 'ts'),
			doc: docOf(member, text)
		});
	}
	return groups.filter((each) => each.members.length > 0);
}

/** The exported components, each with the comment at the top of its script. */
function components(): { name: string; doc: string[] }[] {
	// The main entry names each component and the file it is in.
	const index = readFileSync(resolve(lib, 'index.ts'), 'utf8');
	const exported = [
		...index.matchAll(/export \{ default as (\w+) \} from '\.\/(svelte\/[\w-]+\.svelte)'/g)
	];
	if (exported.length === 0) throw new Error('No components found in the main entry');
	return exported.map(([, name, file]) => {
		const text = readFileSync(resolve(lib, file), 'utf8');
		const comment = /\/\*\*([\s\S]*?)\*\//.exec(text)?.[1] ?? '';
		const doc = comment
			.split('\n')
			.map((line) => line.replace(/^\s*\* ?/, ''))
			.join('\n')
			.split(/\n\s*@\w+/)[0]
			.trim()
			.split(/\n\s*\n/)
			.map((paragraph) =>
				inline(
					paragraph
						.replace(/\s*\n\s*/g, ' ')
						.replace(/^\w+: /, '')
						.trim()
				)
			)
			.filter(Boolean);
		return { name, doc };
	});
}

export async function load() {
	return {
		editor: await classMembers('core/editor.ts', 'Editor'),
		shapeUtil: await classMembers('core/shape-util.ts', 'ShapeUtil', 'ShapeUtil'),
		stateNode: await classMembers('core/state-node.ts', 'StateNode', 'StateNode'),
		components: components()
	};
}
