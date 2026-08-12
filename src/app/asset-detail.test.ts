import { describe, expect, it } from 'vitest';

import type { AssetSummary, Collection } from 'api/collections';
import { CREATED_COLLECTION_ID } from 'api/minted-assets';

import {
	assetDetailErrorMessage,
	assetDetailLoadingPresentation,
	assetStateErrorMessage,
	mergeAssetDetailMetadata,
} from './App';

const assetId = 'A'.repeat(43);

describe('asset detail fallbacks', () => {
	it('labels Atomic Asset shells as token@1.0 while retaining carrier@1.0 for names', () => {
		const images: Collection = {
			id: 'images',
			name: 'Images',
			description: '',
			kind: 'images',
			assets: [],
		};
		const names: Collection = { ...images, id: 'names', name: 'Names', kind: 'names' };

		expect(assetDetailLoadingPresentation(images, images.id)).toEqual({ kind: 'images', device: 'token@1.0' });
		expect(assetDetailLoadingPresentation(undefined, CREATED_COLLECTION_ID)).toEqual({
			kind: 'images',
			device: 'token@1.0',
		});
		expect(assetDetailLoadingPresentation(names, names.id)).toEqual({ kind: 'names', device: 'carrier@1.0' });
	});

	it('replaces an ID-only manifest label with permanent indexed metadata', () => {
		const manifestAsset: AssetSummary = {
			id: assetId,
			name: `${assetId.slice(0, 7)}…${assetId.slice(-6)}`,
			image: `https://arweave.net/${assetId}`,
		};
		const indexedAsset: AssetSummary = {
			id: assetId,
			name: 'AntiqueWhite',
			contentType: 'image/png',
			image: `https://arweave.net/raw/${assetId}`,
		};

		expect(mergeAssetDetailMetadata(manifestAsset, indexedAsset)).toEqual(indexedAsset);
		expect(mergeAssetDetailMetadata({ ...manifestAsset, name: 'Curated title' }, indexedAsset)).toEqual({
			...indexedAsset,
			name: 'Curated title',
		});
	});

	it('turns ao-wrangler quorum failures into asset-specific compute availability copy', () => {
		const internal = 'ao wrangler response quorum not met';
		const friendly = assetStateErrorMessage(new Error(internal));
		expect(friendly).not.toContain(internal);
		expect(friendly).toContain('configured compute gateways');
		expect(assetDetailErrorMessage(friendly, { name: 'AntiqueWhite' }, true)).toBe(
			'AntiqueWhite is published and indexed, but its ownership and market state are currently unavailable from the configured compute peers. Retry shortly.'
		);
	});
});
