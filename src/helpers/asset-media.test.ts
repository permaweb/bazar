import { describe, expect, it } from 'vitest';

import {
	isDisplayAssetContentType,
	isHtmlContentType,
	isSupportedAssetContentType,
	normalizeDisplayAssetContentType,
} from './asset-media';

describe('asset display media', () => {
	it('adds HTML to display support without enabling it in the current mint form', () => {
		expect(normalizeDisplayAssetContentType('text/html; charset=utf-8')).toBe('text/html');
		expect(normalizeDisplayAssetContentType('', 'artwork.html')).toBe('text/html');
		expect(isHtmlContentType('text/html')).toBe(true);
		expect(isDisplayAssetContentType('text/html')).toBe(true);
		expect(isSupportedAssetContentType('text/html')).toBe(false);
	});
});
