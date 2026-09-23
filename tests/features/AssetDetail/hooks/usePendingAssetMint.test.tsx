// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CREATED_COLLECTION_ID, type MintActivity, type MintedAsset } from 'api/mint';

import { usePendingAssetMint } from 'features/AssetDetail/hooks/usePendingAssetMint';

import { renderHook, settle } from '../../../test-utils/render-hook';

const assetId = 'A'.repeat(43);
const owner = 'W'.repeat(43);

const navigate = vi.fn();
const loadMintActivities = vi.fn();
const loadMintedAssets = vi.fn();
const mintActivities: MintActivity[] = [];

vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));

vi.mock('api/mint', async (importOriginal) => ({
	...(await importOriginal<typeof import('api/mint')>()),
	loadMintActivities: (storage: unknown) => loadMintActivities(storage),
	loadMintedAssets: () => loadMintedAssets(),
}));

vi.mock('providers/OperationActivityProvider', () => ({ useOperationActivity: () => ({ mintActivities }) }));

const asset: MintedAsset = {
	id: assetId,
	name: 'AntiqueWhite',
	description: 'Permanent artwork',
	mediaId: 'R'.repeat(43),
	owner,
	createdAt: 10,
};

const activity: MintActivity = {
	id: `mint:${owner}:${assetId}`,
	owner,
	asset,
	collectionId: CREATED_COLLECTION_ID,
	transactionIds: ['T'.repeat(43)],
	arweaveGateway: 'https://arweave.net',
	computeGateway: 'https://compute.example',
	phase: 'accepted',
	status: 'Accepted by Arweave',
	createdAt: 10,
};

beforeEach(() => {
	navigate.mockReset();
	loadMintActivities.mockReset().mockReturnValue([]);
	loadMintedAssets.mockReset().mockReturnValue([]);
	mintActivities.length = 0;
});

afterEach(() => vi.restoreAllMocks());

describe('pending asset mint', () => {
	it('falls back to the uploads saved in this browser', async () => {
		loadMintActivities.mockReturnValue([activity]);
		const harness = renderHook(
			(input: { collectionId: string; assetId: string }) =>
				usePendingAssetMint(input.collectionId, input.assetId),
			{ collectionId: 'unknown-collection', assetId }
		);
		await settle();
		expect(harness.current().activity).toEqual(activity);
		expect(harness.current().asset).toEqual(asset);
		expect(harness.current().finalPath).toBe(`/asset/${CREATED_COLLECTION_ID}/${assetId}`);
		harness.unmount();
	});

	it('routes to the asset page once the mint reports it live', async () => {
		mintActivities.push(activity);
		const harness = renderHook(
			(input: { collectionId: string; assetId: string }) =>
				usePendingAssetMint(input.collectionId, input.assetId),
			{ collectionId: CREATED_COLLECTION_ID, assetId }
		);
		await React.act(async () => {
			window.dispatchEvent(new CustomEvent('bazar:mint-live', { detail: { asset: { id: 'B'.repeat(43) } } }));
			await Promise.resolve();
		});
		expect(navigate).not.toHaveBeenCalled();
		await React.act(async () => {
			window.dispatchEvent(new CustomEvent('bazar:mint-live', { detail: activity }));
			await Promise.resolve();
		});
		expect(navigate).toHaveBeenCalledWith(`/asset/${CREATED_COLLECTION_ID}/${assetId}`, { replace: true });

		harness.unmount();
		navigate.mockReset();
		await React.act(async () => {
			window.dispatchEvent(new CustomEvent('bazar:mint-live', { detail: activity }));
			await Promise.resolve();
		});
		expect(navigate).not.toHaveBeenCalled();
	});

	it('reports an upload this browser never saved', async () => {
		const harness = renderHook(
			(input: { collectionId: string; assetId: string }) =>
				usePendingAssetMint(input.collectionId, input.assetId),
			{ collectionId: CREATED_COLLECTION_ID, assetId }
		);
		await settle();
		expect(harness.current().activity).toBeUndefined();
		expect(harness.current().asset).toBeUndefined();
		expect(harness.current().finalPath).toBe(`/asset/${CREATED_COLLECTION_ID}/${assetId}`);
		harness.unmount();
	});
});
