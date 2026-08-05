import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  canPreviewRecallImage,
  fetchBoundedRecallImage,
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
  afterEach(() => vi.restoreAllMocks());

  it('previews only images whose bounded size is known', () => {
    expect(canPreviewRecallImage(image(512_000))).toBe(true);
    expect(canPreviewRecallImage(image(MAX_RECALL_IMAGE_PREVIEW_BYTES))).toBe(true);
    expect(canPreviewRecallImage(image(MAX_RECALL_IMAGE_PREVIEW_BYTES + 1))).toBe(false);
    expect(canPreviewRecallImage(image())).toBe(false);
  });

  it('never treats non-images as visual previews', () => {
    expect(
      canPreviewRecallImage({
        ...image(512_000),
        contentType: 'application/pdf',
        kind: 'pdf',
      }),
    ).toBe(false);
  });

  it('streams an image preview when HEAD metadata omitted its size', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/png' } }),
    );

    const preview = await fetchBoundedRecallImage(image(), new AbortController().signal);

    expect(preview?.size).toBe(3);
    expect(preview?.type).toBe('image/png');
  });

  it('aborts an unknown-size image after the preview byte limit', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(new Uint8Array(3), {
        headers: { 'content-type': 'image/png' },
      }),
    );

    await expect(fetchBoundedRecallImage(image(), new AbortController().signal, 2)).resolves.toBeUndefined();
  });
});
