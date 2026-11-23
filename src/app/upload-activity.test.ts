import { describe, expect, it } from 'vitest';
import type { ObserverView } from 'weave-wrangler';

import { FUNGIBLE_TOKEN_COLLECTION_ID } from 'api/collections';
import type { MintActivity } from 'api/mint-activity';

import {
	mintActivityMenuCopy,
	type UploadActivity,
	uploadActivityEyebrow,
	uploadActivityFromMintActivity,
	uploadActivitySyncSteps,
} from './App';

const processId = 'P'.repeat(43);
const owner = 'O'.repeat(43);

const upload: UploadActivity = {
	id: 'upload-1',
	owner,
	kind: 'asset',
	name: 'Atomic image',
	phase: 'tracking',
	status: 'Waiting for live process state',
	createdAt: 1,
	transactionIds: [processId],
	transactions: [{ id: processId, label: 'Asset transaction' }],
	assetId: processId,
};

const mint: MintActivity = {
	id: `mint:${owner}:${processId}`,
	owner,
	asset: {
		id: processId,
		name: 'Atomic image',
		description: '',
		contentType: 'image/png',
		image: `https://arweave.net/raw/${processId}`,
		mediaId: processId,
		owner,
		createdAt: 1,
	},
	collectionId: 'created-assets',
	transactionIds: [processId],
	arweaveGateway: 'https://arweave.net',
	computeGateway: 'https://alpha.example',
	phase: 'mined',
	status: 'Mined on Arweave. Waiting for live process state.',
	createdAt: 1,
};

function observer(host: string): ObserverView {
	return {
		observer: { url: `https://${host}`, label: host, source: 'peer', failures: 0 },
		state: 'confirmed',
		confirmations: 8,
		blockId: 'block',
		blockHeight: 10,
		updatedAt: 2,
		changedAt: 2,
	};
}

describe('upload observer lanes', () => {
	it('does not invent a local observer lane before the network answers', () => {
		expect(uploadActivitySyncSteps(upload, [mint])[0]).toMatchObject({
			confirmations: 1,
			terminal: true,
			transaction: { id: processId, views: [] },
		});
	});

	it('renders every live observer view attached to the uploaded transaction', () => {
		const views = [observer('alpha.example'), observer('bravo.example'), observer('charlie.example')];
		const step = uploadActivitySyncSteps(upload, [mint], { [processId]: { views } })[0];

		expect(step.transaction?.views).toEqual(views);
		expect(step.transaction?.views.map((view) => view.observer.label)).toEqual([
			'alpha.example',
			'bravo.example',
			'charlie.example',
		]);
	});
});

describe('mint activity labels', () => {
	const logoId = 'L'.repeat(43);
	const tokenMint: MintActivity = {
		...mint,
		asset: {
			...mint.asset,
			name: 'Test Token',
			contentType: 'application/x.arweave-token',
			ticker: 'TEST',
		},
		collectionId: FUNGIBLE_TOKEN_COLLECTION_ID,
		transactionIds: [logoId, processId],
	};

	it('labels a token mint restored from Activity as a token, not an artwork upload', () => {
		const activity = uploadActivityFromMintActivity(tokenMint);

		expect(activity.transactions).toEqual([
			{ id: logoId, label: 'Token logo transaction' },
			{ id: processId, label: 'Token process transaction' },
		]);
		expect(uploadActivityEyebrow(activity)).toBe('Token mint');
		expect(mintActivityMenuCopy(tokenMint)).toEqual({
			kind: 'Token mint',
			attention: 'This token mint has not reached live process state.',
		});
	});

	it('keeps the artwork and asset labels for an atomic asset mint', () => {
		const artworkId = 'A'.repeat(43);
		const assetMint: MintActivity = { ...mint, transactionIds: [artworkId, processId] };
		const activity = uploadActivityFromMintActivity(assetMint);

		expect(activity).toMatchObject({ kind: 'asset', phase: 'tracking', assetId: processId });
		expect(activity.transactions.map((transaction) => transaction.label)).toEqual([
			'Artwork transaction',
			'Asset transaction',
		]);
		expect(uploadActivityEyebrow(activity)).toBe('Asset upload');
		expect(uploadActivityEyebrow({ kind: 'collection' })).toBe('Collection upload');
		expect(mintActivityMenuCopy(assetMint).kind).toBe('Upload');
	});
});
