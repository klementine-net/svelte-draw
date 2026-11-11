/*
 * Saving the canvas as a picture, and the document as a file. A picture is made from what is
 * on screen: the shapes' own elements are copied into an SVG (`foreignObject`), with the
 * styles, colours and fonts they need packed in, because a picture cannot load anything from
 * outside itself. A PNG is that SVG drawn onto a canvas.
 */

import { tick } from 'svelte';
import { box, migrate, type DocumentFile, type Editor } from '../index.ts';

/** The theme values the shapes' styles read; they are packed into the picture. */
const VARIABLES = [
	'--kd-ink',
	'--kd-grey',
	'--kd-red',
	'--kd-yellow',
	'--kd-green',
	'--kd-blue',
	'--kd-violet',
	'--kd-white',
	'--kd-light-red',
	'--kd-light-green',
	'--kd-light-blue',
	'--kd-light-violet',
	'--kd-select',
	'--canvas-ground',
	'--line-strong',
	'--kd-font-hand',
	'--kd-font-sans',
	'--kd-font-serif',
	'--kd-font-mono'
];

const toDataUrl = (blob: Blob) =>
	new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result));
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(blob);
	});

/** The page's style rules that the shapes use, with font files packed in as data. */
async function collectStyles(): Promise<string> {
	const rules: string[] = [];
	const walk = (list: CSSRuleList) => {
		for (const rule of list) {
			if (rule instanceof CSSFontFaceRule) rules.push(rule.cssText);
			else if ('cssRules' in rule && !(rule instanceof CSSStyleRule))
				walk((rule as CSSGroupingRule).cssRules);
			else if (/kd-|svelte-/.test(rule.cssText)) rules.push(rule.cssText);
		}
	};
	for (const sheet of document.styleSheets) {
		try {
			walk(sheet.cssRules);
		} catch {
			// A style sheet from another origin cannot be read: its rules are left out.
		}
	}
	let css = rules.join('\n');
	const links = [...new Set([...css.matchAll(/url\(["']?([^"')]+)["']?\)/g)].map((m) => m[1]))];
	for (const link of links) {
		if (link.startsWith('data:')) continue;
		try {
			const data = await toDataUrl(await (await fetch(link)).blob());
			css = css.split(link).join(data);
		} catch {
			// A font that cannot be fetched falls back to the next one in the list.
		}
	}
	return css;
}

export interface PictureOptions {
	/** Only these shapes. Everything on the page by default. */
	ids?: readonly string[];
	/** Space around the shapes, in page units. */
	padding?: number;
	/** False for a see-through background. */
	background?: boolean;
}

/**
 * The page (or the given shapes) as an SVG. `root` is the canvas's element (`.kd-root`), or
 * any element inside or around it.
 */
export async function toSvg(
	editor: Editor,
	root: Element,
	options: PictureOptions = {}
): Promise<{ svg: string; width: number; height: number } | undefined> {
	const canvas = root.closest('.kd-root') ?? root.querySelector('.kd-root') ?? root;
	const world = canvas.querySelector('.kd-world');
	const shapes = options.ids
		? editor.getShapes().filter((shape) => options.ids!.includes(shape.id))
		: editor.getShapes();
	const bounds = box.union(shapes.map((shape) => editor.getShapePageBounds(shape)));
	if (!world || !bounds) return undefined;
	const padding = options.padding ?? 32;
	const width = Math.ceil(bounds.w + padding * 2);
	const height = Math.ceil(bounds.h + padding * 2);

	// Shapes that are off screen are not drawn; for the picture they all have to be.
	editor.culling.set(false);
	await tick();
	const copy = world.cloneNode(true) as HTMLElement;
	editor.culling.set(true);
	if (options.ids) {
		// With everything that sits in a picked shape.
		const kept = new Set(options.ids);
		for (const shape of editor.getShapes()) if (kept.has(shape.parentId)) kept.add(shape.id);
		for (const element of copy.querySelectorAll<HTMLElement>('.kd-shape'))
			if (!kept.has(element.dataset.id ?? '')) element.remove();
	}
	copy.style.transform = `translate(${padding - bounds.x}px, ${padding - bounds.y}px)`;

	const computed = getComputedStyle(canvas);
	const variables = VARIABLES.map((name) => `${name}: ${computed.getPropertyValue(name)};`).join(
		' '
	);
	const ground = options.background === false ? 'transparent' : 'var(--canvas-ground)';
	const styles = await collectStyles();
	const html = new XMLSerializer().serializeToString(copy);
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<foreignObject width="100%" height="100%">
<div xmlns="http://www.w3.org/1999/xhtml" style="position: relative; width: ${width}px; height: ${height}px; overflow: hidden; background: ${ground}; color-scheme: ${computed.colorScheme}; ${variables}">
<style>${styles.replaceAll('<', '&lt;')}</style>
${html}
</div>
</foreignObject>
</svg>`;
	return { svg, width, height };
}

/** The page (or the given shapes) as a PNG, at twice the size for sharp screens. */
export async function toPng(
	editor: Editor,
	root: Element,
	options: PictureOptions & { scale?: number } = {}
): Promise<Blob | undefined> {
	const picture = await toSvg(editor, root, options);
	if (!picture) return undefined;
	const scale = options.scale ?? 2;
	const image = new Image();
	await new Promise((resolve, reject) => {
		image.onload = resolve;
		image.onerror = reject;
		image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(picture.svg)}`;
	});
	const canvas = document.createElement('canvas');
	canvas.width = picture.width * scale;
	canvas.height = picture.height * scale;
	canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height);
	return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob ?? undefined), 'image/png'));
}

/** Hands the browser a file to save. */
export function download(blob: Blob, name: string) {
	const link = document.createElement('a');
	link.href = URL.createObjectURL(blob);
	link.download = name;
	link.click();
	setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

/** Saves the document as a file that `openFile` reads again. */
export function saveFile(editor: Editor, name = 'drawing') {
	const json = JSON.stringify(editor.getDocument());
	download(new Blob([json], { type: 'application/json' }), `${name}.draw.json`);
}

/** Lets the user pick a saved document and replaces the one on screen with it. */
export function openFile(editor: Editor) {
	const input = document.createElement('input');
	input.type = 'file';
	input.accept = '.json,application/json';
	input.onchange = async () => {
		const file = input.files?.[0];
		if (!file) return;
		try {
			const saved = JSON.parse(await file.text()) as DocumentFile;
			if (!Array.isArray(saved.records)) throw new Error('No records in this file');
			editor.loadDocument(migrate(saved), 'user');
		} catch (error) {
			console.error('This file could not be opened as a drawing.', error);
		}
	};
	input.click();
}
