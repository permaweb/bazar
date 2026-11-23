import { Info } from 'lucide-react';

/** Collection mints and appends accept at most this many images per batch (CollectionMintClient). */
export const COLLECTION_FILE_LIMIT = 10;

/** 'replace' starts a new selection (first pick, dropzone); 'append' extends it ("Add images"). */
export type CollectionPickMode = 'replace' | 'append';

export type CollectionFileSelection = { files: File[]; dropped: number };

function collectionFileKey(file: File) {
	return `${file.name}\u0000${file.size}\u0000${file.lastModified}`;
}

/**
 * Appends `picked` to `current` in order, skipping files already selected
 * (same name, size and lastModified), and keeps at most `cap` files.
 * `dropped` counts the new, non-duplicate files that did not fit.
 */
export function mergeCollectionFiles(
	current: readonly File[],
	picked: readonly File[],
	cap = COLLECTION_FILE_LIMIT
): CollectionFileSelection {
	const seen = new Set<string>();
	const unique: File[] = [];
	for (const file of [...current, ...picked]) {
		const key = collectionFileKey(file);
		if (seen.has(key)) continue;
		seen.add(key);
		unique.push(file);
	}
	return { files: unique.slice(0, cap), dropped: Math.max(0, unique.length - cap) };
}

export function pickCollectionFiles(
	current: readonly File[],
	picked: readonly File[],
	mode: CollectionPickMode,
	cap = COLLECTION_FILE_LIMIT
): CollectionFileSelection {
	return mergeCollectionFiles(mode === 'append' ? current : [], picked, cap);
}

export function collectionSelectionNoticeText(dropped: number, cap = COLLECTION_FILE_LIMIT) {
	return `Collections support up to ${cap} images at a time. ${dropped} ${
		dropped === 1 ? 'image was' : 'images were'
	} not added.`;
}

/**
 * Says how many picked images were left out by the per-batch cap. It lives in
 * its own selection state, so cost estimates and other errors never clear it;
 * only the next selection change does.
 */
export function CollectionSelectionNotice({ dropped }: { dropped: number }) {
	if (dropped <= 0) return null;
	return (
		<p className="mint-notice collection-selection-notice" role="status">
			<Info className="ui-icon" aria-hidden="true" />
			<span>{collectionSelectionNoticeText(dropped)}</span>
		</p>
	);
}
