/*
 * The link shape: a web address on the canvas. A pasted address becomes one. A video the
 * view knows how to play (YouTube, Vimeo) shows its player; any other address shows a card
 * with where it leads.
 */

import type { Box } from '../core/geometry.ts';
import type { ShapeRecord, StyleKey } from '../core/records.ts';
import { ShapeUtil, type ResizeResult } from '../core/shape-util.ts';

export type LinkProps = { url: string; w: number; h: number };
export type LinkShape = ShapeRecord<'link', LinkProps>;

/** The address a player for this link is loaded from, or undefined when it is no known video. */
export function embedUrl(url: string): string | undefined {
	const youtube = url.match(/(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/)([\w-]{6,})/);
	if (youtube) return `https://www.youtube-nocookie.com/embed/${youtube[1]}`;
	const vimeo = url.match(/vimeo\.com\/(\d+)/);
	if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
	return undefined;
}

export class LinkShapeUtil extends ShapeUtil<LinkShape> {
	static override kind = 'link';
	override readonly styles: readonly StyleKey[] = ['opacity'];

	defaultProps(): LinkProps {
		return { url: '', w: 320, h: 72 };
	}

	bounds(shape: LinkShape): Box {
		return { x: 0, y: 0, w: shape.props.w, h: shape.props.h };
	}

	/** Pasted text that is nothing but a web address becomes a link. */
	override fromText(text: string): LinkProps | undefined {
		if (!/^https?:\/\/\S+$/.test(text)) return undefined;
		return embedUrl(text) ? { url: text, w: 480, h: 270 } : { url: text, w: 320, h: 72 };
	}

	/** A double click makes the link live: the card can be followed, the player played. */
	override canEdit() {
		return true;
	}

	resize(shape: LinkShape, target: Box): ResizeResult<LinkShape> {
		return {
			x: target.x,
			y: target.y,
			props: { ...shape.props, w: Math.max(120, target.w), h: Math.max(48, target.h) }
		};
	}
}
