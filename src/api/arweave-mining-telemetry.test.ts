import { describe, expect, it } from 'vitest';

import {
	canPreviewRecallImage,
	MAX_RECALL_IMAGE_PREVIEW_BYTES,
	type ArweaveRecallContent,
} from './arweave-mining-telemetry';

function image(contentLength?: number): ArweaveRecallContent {
	return {
		contentLength,
		contentType: 'image/png',
		contentUrl: 'https://example.test/image',
		kind: 'image',
	};
}

describe('recall image previews', () => {
	it('previews only images whose bounded size is known', () => {
		expect(canPreviewRecallImage(image(512_000))).toBe(true);
		expect(canPreviewRecallImage(image(MAX_RECALL_IMAGE_PREVIEW_BYTES))).toBe(true);
		expect(canPreviewRecallImage(image(MAX_RECALL_IMAGE_PREVIEW_BYTES + 1))).toBe(false);
		expect(canPreviewRecallImage(image())).toBe(false);
	});

	it('never treats non-images as visual previews', () => {
		expect(canPreviewRecallImage({
			...image(512_000),
			contentType: 'application/pdf',
			kind: 'pdf',
		})).toBe(false);
	});
});
