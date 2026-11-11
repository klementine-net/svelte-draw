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
export const COLORS = ['ink', 'grey', 'red', 'yellow', 'green', 'blue', 'violet'] as const;
export type ColorName = (typeof COLORS)[number];

export const FILLS = ['none', 'tint', 'solid'] as const;
export type FillName = (typeof FILLS)[number];

export const SIZES = ['s', 'm', 'l'] as const;
export type SizeName = (typeof SIZES)[number];

/** `sketch` draws like a pen on paper; `precise` draws exact vector lines. */
export const LOOKS = ['sketch', 'precise'] as const;
export type LookName = (typeof LOOKS)[number];

export interface ShapeStyle {
	color: ColorName;
	fill: FillName;
	size: SizeName;
	look: LookName;
}

export const DEFAULT_STYLE: ShapeStyle = { color: 'ink', fill: 'none', size: 'm', look: 'sketch' };

/** Stroke width in page units for each size. */
export const STROKE_WIDTH: Record<SizeName, number> = { s: 2, m: 3.5, l: 6 };

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
	style: ShapeStyle;
	props: Props;
}

export type DrawRecord = PageRecord | ShapeRecord;

let counter = 0;

/** A new record id, `shape:…` or `page:…`. */
export function createId(type: 'shape' | 'page'): string {
	const random =
		typeof crypto !== 'undefined' && 'randomUUID' in crypto
			? crypto.randomUUID().replaceAll('-', '').slice(0, 16)
			: Math.random().toString(36).slice(2, 12) + (counter++).toString(36);
	return `${type}:${random}`;
}
