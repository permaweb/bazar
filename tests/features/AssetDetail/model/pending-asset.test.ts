import { describe, expect, it } from 'vitest';

import { CREATED_COLLECTION_ID, type MintActivity, type MintedAsset } from 'api/mint';

import { PENDING_MINT_PHASES, pendingMintView } from 'features/AssetDetail/model/pending-asset';

const assetId = 'A'.repeat(43);
const owner = 'W'.repeat(43);
const artworkTx = 'R'.repeat(43);
const assetTx = 'T'.repeat(43);

const asset: MintedAsset = {
	id: assetId,
	name: 'AntiqueWhite',
	contentType: 'image/png',
	description: 'Permanent artwork',
	mediaId: artworkTx,
	owner,
	createdAt: 10,
};

const activity: MintActivity = {
	id: `mint:${owner}:${assetId}`,
	owner,
	asset,
	collectionId: CREATED_COLLECTION_ID,
	transactionIds: [artworkTx, assetTx],
	arweaveGateway: 'https://arweave.net',
	computeGateway: 'https://compute.example',
	phase: 'mined',
	status: 'Mined into a block',
	createdAt: 10,
};

function view(overrides: Partial<Parameters<typeof pendingMintView>[0]> = {}) {
	return pendingMintView({
		activity,
		asset,
		collectionId: CREATED_COLLECTION_ID,
		arweaveGateway: 'https://arweave.net',
		computeGateway: 'https://compute.example',
		...overrides,
	});
}

describe('pending mint page', () => {
	it('labels a unique upload and tracks its progress through the listed phases', () => {
		expect(view()).toEqual({
			fungible: false,
			currentPhaseIndex: PENDING_MINT_PHASES.indexOf('mined'),
			pinnedGateway: false,
			transactions: [
				{ transactionId: artworkTx, role: 'artwork' },
				{ transactionId: assetTx, role: 'asset' },
			],
		});
		expect(view({ activity: { ...activity, phase: 'complete' } }).currentPhaseIndex).toBe(
			PENDING_MINT_PHASES.length - 1
		);
	});

	it('labels a token upload by its logo and process transactions', () => {
		expect(view({ asset: { ...asset, ticker: 'MIST' } }).transactions).toEqual([
			{ transactionId: artworkTx, role: 'logo' },
			{ transactionId: assetTx, role: 'token' },
		]);
		expect(view({ activity: { ...activity, collectionId: 'fungible-tokens' } }).fungible).toBe(true);
	});

	it('reports when the upload is tracked against other gateways than the current selection', () => {
		expect(view({ arweaveGateway: 'https://other.example' }).pinnedGateway).toBe(true);
		expect(view({ computeGateway: 'https://other-compute.example' }).pinnedGateway).toBe(true);
	});

	it('keeps a single-transaction upload labelled as the asset itself', () => {
		expect(view({ activity: { ...activity, transactionIds: [assetTx] } }).transactions).toEqual([
			{ transactionId: assetTx, role: 'asset' },
		]);
	});
});
