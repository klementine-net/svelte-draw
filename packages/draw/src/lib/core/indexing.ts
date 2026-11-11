/*
 * Fractional indexes: the stacking order of shapes as strings that sort with plain `<`. A shape
 * can move between two others without renumbering anyone, which is what keeps reordering safe
 * when two people do it at once. The keys come from `fractional-indexing` (CC0), which keeps
 * them short however often shapes are appended. Two people can still make the same key at the
 * same moment, so every sort by index breaks ties by id (`byIndex`).
 */

import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing';

/**
 * An index strictly between `below` and `above`. Pass undefined for an open end (below the
 * lowest, above the highest). `below` must sort before `above`.
 */
export function indexBetween(below?: string, above?: string): string {
	return generateKeyBetween(below ?? null, above ?? null);
}

/** `count` ascending indexes above `below`. */
export function indexesAbove(below: string | undefined, count: number): string[] {
	return generateNKeysBetween(below ?? null, null, count);
}

/** Sorts records bottom to top: by index, then by id so equal indexes order the same everywhere. */
export function byIndex(
	a: { index: string; id: string },
	b: { index: string; id: string }
): number {
	if (a.index !== b.index) return a.index < b.index ? -1 : 1;
	return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
