/*
 * The image shape: a picture from a file that was dropped, pasted or picked. The shape holds
 * only the id of an asset record; the file itself is in that record (see AssetRecord), so
 * moving or resizing the picture never re-sends it.
 */

import type { Box } from '../core/geometry.ts';
import { createId, type AssetRecord, type ShapeRecord, type StyleKey } from '../core/records.ts';
import { ShapeUtil, type ResizeResult } from '../core/shape-util.ts';

export type ImageProps = { assetId: string; w: number; h: number };
export type ImageShape = ShapeRecord<'image', ImageProps>;

/** The longest side (page units) a new picture gets; larger files are shown smaller. */
const MAX_SIDE = 560;

/** A picture file's own size. Browser only. */
async function pictureSize(file: Blob): Promise<{ w: number; h: number }> {
	const url = URL.createObjectURL(file);
	try {
		const picture = new Image();
		await new Promise((resolve, reject) => {
			picture.onload = resolve;
			picture.onerror = reject;
			picture.src = url;
		});
		// A drawing without a size of its own (some SVGs) gets a plain one.
		return { w: picture.naturalWidth || 300, h: picture.naturalHeight || 200 };
	} finally {
		URL.revokeObjectURL(url);
	}
}

export class ImageShapeUtil extends ShapeUtil<ImageShape> {
	static override kind = 'image';
	override readonly styles: readonly StyleKey[] = ['opacity'];

	defaultProps(): ImageProps {
		return { assetId: '', w: 300, h: 200 };
	}

	bounds(shape: ImageShape): Box {
		return { x: 0, y: 0, w: shape.props.w, h: shape.props.h };
	}

	override assets(shape: ImageShape): string[] {
		return shape.props.assetId ? [shape.props.assetId] : [];
	}

	/** Any picture file becomes an image: the file goes to the asset store, its link to a record. */
	override async fromFile(file: Blob) {
		if (!file.type.startsWith('image/')) return undefined;
		const [src, size] = await Promise.all([this.editor.assets.upload(file), pictureSize(file)]);
		const asset: AssetRecord = {
			id: createId('asset'),
			type: 'asset',
			name: (file as File).name ?? 'Image',
			mime: file.type,
			w: size.w,
			h: size.h,
			src
		};
		const scale = Math.min(1, MAX_SIDE / Math.max(size.w, size.h));
		return {
			props: { assetId: asset.id, w: size.w * scale, h: size.h * scale },
			assets: [asset]
		};
	}

	resize(shape: ImageShape, target: Box): ResizeResult<ImageShape> {
		return {
			x: target.x,
			y: target.y,
			props: { ...shape.props, w: Math.max(8, target.w), h: Math.max(8, target.h) }
		};
	}
}
