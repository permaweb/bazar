import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
	CollectionSelectionNotice,
	collectionSelectionNoticeText,
	mergeCollectionFiles,
	pickCollectionFiles,
} from './CollectionSelectionNotice';

function image(name: string, lastModified = 1, body = name) {
	return new File([body], `${name}.png`, { type: 'image/png', lastModified });
}

function images(prefix: string, count: number) {
	return Array.from({ length: count }, (_, index) => image(`${prefix}${index + 1}`));
}

const names = (files: readonly File[]) => files.map((file) => file.name);

describe('mergeCollectionFiles', () => {
	it('appends new picks after the current selection, in order', () => {
		const first = images('a', 3);
		const more = images('b', 2);

		const merged = mergeCollectionFiles(first, more);

		expect(names(merged.files)).toEqual(['a1.png', 'a2.png', 'a3.png', 'b1.png', 'b2.png']);
		expect(merged.dropped).toBe(0);
	});

	it('keeps the first 10 images and counts the rest as dropped', () => {
		const merged = mergeCollectionFiles([], images('c', 12));

		expect(names(merged.files)).toEqual(names(images('c', 10)));
		expect(merged.dropped).toBe(2);
	});

	it('counts only the images that did not fit when appending past the cap', () => {
		const merged = mergeCollectionFiles(images('a', 8), images('b', 5));

		expect(merged.files).toHaveLength(10);
		expect(names(merged.files).slice(8)).toEqual(['b1.png', 'b2.png']);
		expect(merged.dropped).toBe(3);
	});

	it('does not duplicate images that are picked again', () => {
		const first = images('a', 3);
		const again = [image('a2'), image('a3'), image('d1')];

		const merged = mergeCollectionFiles(first, again);

		expect(names(merged.files)).toEqual(['a1.png', 'a2.png', 'a3.png', 'd1.png']);
		expect(merged.dropped).toBe(0);
		expect(mergeCollectionFiles(first, first).files).toEqual(first);
	});

	it('treats same-named files with a different size or modification time as different images', () => {
		const merged = mergeCollectionFiles([image('a', 1)], [image('a', 2), image('a', 1, 'larger body')]);

		expect(merged.files).toHaveLength(3);
	});
});

describe('pickCollectionFiles transitions', () => {
	it('"Add images" (append) extends the selection: 3 + 2 -> 5', () => {
		const first = pickCollectionFiles([], images('a', 3), 'replace');
		const added = pickCollectionFiles(first.files, images('b', 2), 'append');

		expect(added.files).toHaveLength(5);
		expect(names(added.files).slice(0, 3)).toEqual(names(first.files));
		expect(added.dropped).toBe(0);
	});

	it('the dropzone and first pick (replace) start a new selection', () => {
		const first = pickCollectionFiles([], images('a', 3), 'replace');
		const replaced = pickCollectionFiles(first.files, images('b', 2), 'replace');

		expect(names(replaced.files)).toEqual(['b1.png', 'b2.png']);
	});

	it('a later selection change that fits clears the dropped count', () => {
		const over = pickCollectionFiles([], images('c', 12), 'replace');
		expect(over.dropped).toBe(2);

		const removed = pickCollectionFiles(over.files, over.files.slice(1), 'replace');
		expect(removed.files).toHaveLength(9);
		expect(removed.dropped).toBe(0);
	});
});

describe('CollectionSelectionNotice', () => {
	it('says how many images the cap left out, politely and without error styling', () => {
		const markup = renderToStaticMarkup(<CollectionSelectionNotice dropped={4} />);

		expect(markup).toContain('role="status"');
		expect(markup).toContain('mint-notice');
		expect(markup).toContain('Collections support up to 10 images at a time. 4 images were not added.');
		expect(markup).not.toContain('role="alert"');
		expect(markup).not.toContain('inline-error');
	});

	it('uses singular copy for one dropped image', () => {
		expect(collectionSelectionNoticeText(1)).toBe(
			'Collections support up to 10 images at a time. 1 image was not added.'
		);
	});

	it('renders nothing when every picked image fits', () => {
		expect(renderToStaticMarkup(<CollectionSelectionNotice dropped={0} />)).toBe('');
	});
});
