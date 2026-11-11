/* The records a document is made of. Everything a collaborator must see is a record. */

export interface BaseRecord {
	id: string;
	type: string;
}

export interface PageRecord extends BaseRecord {
	type: 'page';
	name: string;
	index: string;
}

/** The named colours a shape can take; the renderer maps them to theme values. */
export const COLORS = [
	'ink',
	'grey',
	'white',
	'yellow',
	'red',
	'green',
	'blue',
	'violet',
	'light-red',
	'light-green',
	'light-blue',
	'light-violet'
] as const;
export type ColorName = (typeof COLORS)[number];

export const FILLS = ['none', 'tint', 'solid', 'pattern'] as const;
export type FillName = (typeof FILLS)[number];

export const SIZES = ['s', 'm', 'l', 'xl'] as const;
export type SizeName = (typeof SIZES)[number];

/**
 * `sketch` draws like a pen on paper; the others draw exact vector lines: `precise` unbroken,
 * `dashed` and `dotted` broken.
 */
export const LOOKS = ['sketch', 'precise', 'dashed', 'dotted'] as const;
export type LookName = (typeof LOOKS)[number];

/** The typeface of a shape's text; the renderer maps the names to fonts (`--kd-font-*`). */
export const FONTS = ['hand', 'sans', 'serif', 'mono'] as const;
export type FontName = (typeof FONTS)[number];

/** How the lines of a shape's text sit: at the start, in the middle, at the end. */
export const ALIGNS = ['start', 'middle', 'end'] as const;
export type AlignName = (typeof ALIGNS)[number];

/** Where a shape's text sits in the shape's height. */
export const VALIGNS = ['top', 'middle', 'bottom'] as const;
export type VAlignName = (typeof VALIGNS)[number];

/** The steps the style panel offers for how see-through a shape is. */
export const OPACITIES = [0.1, 0.25, 0.5, 0.75, 1] as const;

export interface ShapeStyle {
	color: ColorName;
	fill: FillName;
	size: SizeName;
	look: LookName;
	font: FontName;
	align: AlignName;
	valign: VAlignName;
	/** 0 (invisible) to 1 (solid). */
	opacity: number;
}

export type StyleKey = keyof ShapeStyle;

export const DEFAULT_STYLE: ShapeStyle = {
	color: 'ink',
	fill: 'none',
	size: 'm',
	look: 'sketch',
	font: 'hand',
	align: 'middle',
	valign: 'middle',
	opacity: 1
};

/** Stroke width in page units for each size. */
export const STROKE_WIDTH: Record<SizeName, number> = { s: 2, m: 3.5, l: 6, xl: 10 };

/** Text size in page units for each size. */
export const FONT_SIZE: Record<SizeName, number> = { s: 18, m: 24, l: 36, xl: 52 };

/** The dash pattern of a broken line, for a stroke of `width`; undefined for an unbroken one. */
export function dashArray(look: LookName, width: number): string | undefined {
	if (look === 'dashed') return `${width * 2.5} ${width * 2.5}`;
	if (look === 'dotted') return `0.1 ${width * 2.2}`;
	return undefined;
}

// `any` so a util's own shape type (GeoShape, a plugin's) is a ShapeRecord without a cast.
export interface ShapeRecord<
	Kind extends string = string,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	Props = Record<string, any>
> extends BaseRecord {
	type: 'shape';
	/** Which ShapeUtil owns this shape (`geo`, `draw`, a plugin's own). */
	kind: Kind;
	/** A page id, or the id of the shape this one sits in. */
	parentId: string;
	/** Stacking order among siblings (a fractional index). */
	index: string;
	/** Position in the parent's space. */
	x: number;
	y: number;
	/** How far the shape is turned around its origin, in radians. Not there means not turned. */
	rotation?: number;
	/** A locked shape cannot be picked, moved or erased until it is unlocked. */
	locked?: boolean;
	style: ShapeStyle;
	props: Props;
}

/**
 * A file a shape shows (an image). The shape holds only the asset's id, so moving the shape
 * never re-sends the file. `src` is whatever the app's asset store answered: a data URL by
 * default, a link once the app keeps files elsewhere.
 */
export interface AssetRecord extends BaseRecord {
	type: 'asset';
	name: string;
	mime: string;
	/** The picture's own size in pixels. */
	w: number;
	h: number;
	src: string;
}

export type DrawRecord = PageRecord | ShapeRecord | AssetRecord;

/** The version of the record shapes above. Kept with every saved document (see persist.ts). */
export const SCHEMA_VERSION = 1;

let counter = 0;

/** A new record id: `shape:…`, `page:…` or `asset:…`. */
export function createId(type: 'shape' | 'page' | 'asset'): string {
	const random =
		typeof crypto !== 'undefined' && 'randomUUID' in crypto
			? crypto.randomUUID().replaceAll('-', '').slice(0, 16)
			: Math.random().toString(36).slice(2, 12) + (counter++).toString(36);
	return `${type}:${random}`;
}
