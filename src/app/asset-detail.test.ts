import { describe, expect, it } from 'vitest';

import type { AssetSummary, Collection } from 'api/collections';
import { CREATED_COLLECTION_ID } from 'api/minted-assets';

import {
	assetDetailErrorMessage,
	assetDetailLoadingPresentation,
	assetStateErrorMessage,
	assetStateRecoveryUrl,
	mergeAssetActivityPages,
	mergeAssetDetailMetadata,
	uniqueAskHistory,
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
			image: `https://arweave.net/${assetId}`,
		};

		expect(mergeAssetDetailMetadata(manifestAsset, indexedAsset)).toEqual(indexedAsset);
		expect(mergeAssetDetailMetadata({ ...manifestAsset, name: 'Curated title' }, indexedAsset)).toEqual({
			...indexedAsset,
			name: 'Curated title',
		});
	});

	it('turns AO transport quorum failures into asset-specific compute availability copy', () => {
		const friendly = assetStateErrorMessage(new Error('AO response quorum not met'));
		const legacyFriendly = assetStateErrorMessage(new Error('ao-wrangler-response-quorum-not-met'));
		expect(friendly).toContain('the configured AO peers');
		expect(legacyFriendly).toBe(friendly);
		expect(assetDetailErrorMessage(friendly, { name: 'AntiqueWhite' }, true)).toBe(
			'AntiqueWhite is published and indexed, but its ownership and market state are currently unavailable from the configured AO peers. Retry shortly.'
		);
	});

	it('explains a bounded foreground state timeout', () => {
		expect(assetStateErrorMessage(new Error('asset-state-read-timeout'))).toBe(
			'The configured AO peers did not return live state within 45 seconds. Retry or review the AO Core settings in the header.'
		);
	});

	it('offers an explicit Bazar peer route only for failed PermawebOS asset-state reads', () => {
		const href =
			'https://bazar.arweave.net/?node=https%3A%2F%2Falpha.example#/asset/fungible-tokens/WEAVE?tab=market';
		const location = {
			href,
			protocol: 'https:',
			hostname: 'bazar.arweave.net',
			port: '',
			search: '?node=https%3A%2F%2Falpha.example',
			hash: '#/asset/fungible-tokens/WEAVE?tab=market',
		};
		const scope = { aoFetch: (() => undefined) as unknown as PermawebOsAoFetch };

		expect(assetStateRecoveryUrl('Live state unavailable', location, scope)).toBe(
			'https://bazar.arweave.net/?node=https%3A%2F%2Falpha.example&ao-transport=bazar#/asset/fungible-tokens/WEAVE?tab=market'
		);
		expect(assetStateRecoveryUrl(null, location, scope)).toBeNull();
		expect(
			assetStateRecoveryUrl(
				'Live state unavailable',
				{
					...location,
					href: 'https://bazar.arweave.net/?ao-transport=bazar#/asset/fungible-tokens/WEAVE?tab=market',
					search: '?ao-transport=bazar',
				},
				scope
			)
		).toBeNull();
	});

	it('builds a chronologically ordered Unique ask history from signed listing events', () => {
		const shared = {
			processId: assetId,
			actor: 'B'.repeat(43),
			height: 1,
		};
		expect(
			uniqueAskHistory([
				{ ...shared, id: 'later', action: 'make-offer', timestamp: 20, asking: '2500000000000' },
				{ ...shared, id: 'transfer', action: 'transfer', timestamp: 15, asking: '999' },
				{ ...shared, id: 'invalid', action: 'make-offer', timestamp: 12, asking: '0' },
				{ ...shared, id: 'earlier', action: 'make-offer', timestamp: 10, asking: '1000000000000' },
			])
		).toEqual([
			{ id: 'earlier', timestamp: 10, value: '1000000000000' },
			{ id: 'later', timestamp: 20, value: '2500000000000' },
		]);
	});

	it('merges older cursor pages without duplicating indexed activity', () => {
		const event = (id: string, height: number) => ({
			id,
			processId: assetId,
			action: 'transfer' as const,
			actor: 'B'.repeat(43),
			height,
			timestamp: height * 10,
		});
		expect(
			mergeAssetActivityPages(
				[event('newest', 3), event('overlap', 2)],
				[event('overlap', 2), event('oldest', 1)]
			)
		).toEqual([event('newest', 3), event('overlap', 2), event('oldest', 1)]);
	});
});
