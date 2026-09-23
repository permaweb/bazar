import { describe, expect, it } from 'vitest';

import type { CollectionMintResult, FungibleMintResult, MintDraft, MintedAsset } from 'api/mint';

import {
	collectionMintPhaseLabel,
	discardEstimate,
	fungibleMintError,
	fungibleMintPhase,
	fungibleMintResult,
	fungibleMintView,
	mintedAssetUpload,
	mintedCollectionUpload,
	mintFlowReducer,
	type MintFlowState,
	mintFlowState,
	mintPhaseLabel,
	mintPhaseStatus,
	mintReceiptEntries,
	mintResultPath,
	mintUploadId,
	mintWorking,
} from 'features/Create/model/mint-flow';
import { IDLE, LOADING } from 'helpers/async-state';

const OWNER = 'O'.repeat(43);
const PROCESS = 'P'.repeat(43);

const draft: MintDraft = {
	owner: OWNER,
	name: 'Saved mint',
	description: '',
	contentType: 'image/png',
	mediaId: 'M'.repeat(43),
	createdAt: 1,
};

const asset: MintedAsset = {
	id: 'A'.repeat(43),
	name: 'Signal',
	contentType: 'image/png',
	description: '',
	mediaId: 'M'.repeat(43),
	owner: OWNER,
	createdAt: 1,
	artworkId: 'W'.repeat(43),
};

const collection: CollectionMintResult = {
	collection: {
		id: 'C'.repeat(43),
		name: 'Set',
		description: '',
		kind: 'images',
		assets: [{ ...asset }],
		owner: OWNER,
		manifestId: 'N'.repeat(43),
		createdAt: 1,
	},
	manifestId: 'N'.repeat(43),
	processId: PROCESS,
};

const token: FungibleMintResult = {
	processId: PROCESS,
	logo: 'L'.repeat(43),
	owner: OWNER,
	name: 'Signal',
	ticker: 'SIG',
	wholeSupply: '1000',
	atomicSupply: '1000000000000000',
	denomination: 12,
	createdAt: 1,
};

function reduce(state: MintFlowState, ...events: Parameters<typeof mintFlowReducer>[1][]): MintFlowState {
	return events.reduce(mintFlowReducer, state);
}

describe('mint flow', () => {
	it('mints an asset from selection to result', () => {
		const started = reduce(mintFlowState(draft), { type: 'mint-started', mode: 'asset' });
		expect(started.error).toBeNull();
		expect(mintWorking(started)).toBe(false);

		const signing = mintFlowReducer(started, { type: 'asset-phase', phase: 'signing-asset' });
		expect(mintWorking(signing)).toBe(true);
		expect(mintPhaseLabel(signing)).toBe('Approve the atomic asset in your wallet…');

		const minted = mintFlowReducer(signing, { type: 'asset-minted', asset });
		expect(minted).toMatchObject({ assetResult: asset, assetPhase: null, draft: null });
		expect(mintWorking(minted)).toBe(false);
		expect(mintReceiptEntries(minted)).toEqual([
			{ label: 'Artwork transaction', transactionId: asset.artworkId },
			{ label: 'Asset transaction', transactionId: asset.id },
		]);
		expect(mintResultPath(minted)).toContain(`/${asset.id}`);
		expect(mintedAssetUpload(asset)).toMatchObject({
			assetId: asset.id,
			transactionIds: [asset.artworkId, asset.id],
		});
	});

	it('mints a collection and reports its per-asset stages', () => {
		const phase = reduce(
			mintFlowState(null),
			{ type: 'mint-started', mode: 'collection' },
			{ type: 'collection-phase', phase: { kind: 'asset', index: 1, total: 3, phase: 'uploading-asset' } }
		);
		expect(mintWorking(phase)).toBe(true);
		expect(mintPhaseLabel(phase)).toBe('Asset 2 of 3: uploading atomic asset…');
		expect(collectionMintPhaseLabel({ kind: 'manifest', phase: 'signing' })).toBe('Collection manifest: signing…');
		expect(collectionMintPhaseLabel({ kind: 'asset', index: 0, total: 2, phase: 'signing-artwork' })).toBe(
			`Asset 1 of 2: ${mintPhaseStatus('signing-artwork')}`
		);

		const minted = mintFlowReducer(phase, { type: 'collection-minted', result: collection });
		expect(minted).toMatchObject({ collectionResult: collection, collectionPhase: null });
		expect(mintReceiptEntries(minted)).toEqual([
			{ label: 'View collection manifest', transactionId: collection.manifestId },
			{ label: 'View collection process', transactionId: collection.processId },
		]);
		expect(mintResultPath(minted)).toBe(`/collection/${collection.collection.id}`);
		expect(mintedCollectionUpload(collection)).toEqual({
			collectionId: collection.collection.id,
			assetIds: [asset.id],
			transactionIds: [collection.manifestId, collection.processId],
		});
	});

	it('opens the token panel on submit and keeps its stages, result, and failure exclusive', () => {
		const started = mintFlowReducer(mintFlowState(null), { type: 'mint-started', mode: 'fungible' });
		expect(started.fungibleDialogVisible).toBe(true);
		expect(mintWorking(started)).toBe(true);

		const signing = mintFlowReducer(started, { type: 'fungible-phase', phase: 'signing-logo' });
		expect(fungibleMintPhase(signing)).toBe('signing-logo');
		expect(mintPhaseLabel(signing)).toBe('Approve the token logo in your wallet…');

		const minted = mintFlowReducer(signing, { type: 'fungible-minted', result: token });
		expect(fungibleMintResult(minted)).toBe(token);
		expect(fungibleMintPhase(minted)).toBeNull();
		expect(mintWorking(minted)).toBe(false);

		const failed = mintFlowReducer(signing, {
			type: 'mint-failed',
			mode: 'fungible',
			error: 'Dispatch failed.',
			draft: null,
		});
		expect(fungibleMintError(failed)).toBe('Dispatch failed.');
		expect(failed.error).toBeNull();
		expect(mintFlowReducer(failed, { type: 'fungible-error-cleared' }).fungible).toEqual({ status: 'idle' });
	});

	it('restores the saved draft and inline error when a mint fails', () => {
		const failed = reduce(
			mintFlowState(null),
			{ type: 'mint-started', mode: 'asset' },
			{ type: 'asset-phase', phase: 'uploading-asset' },
			{ type: 'mint-failed', mode: 'asset', error: 'Network unavailable', draft }
		);
		expect(failed).toMatchObject({ error: 'Network unavailable', draft, assetPhase: null });
		expect(mintWorking(failed)).toBe(false);

		const resumed = reduce(
			failed,
			{ type: 'asset-phase', phase: 'signing-asset' },
			{ type: 'resume-failed', error: 'Still unavailable' }
		);
		expect(resumed).toMatchObject({ error: 'Still unavailable', assetPhase: null, draft });
		expect(mintFlowReducer(resumed, { type: 'draft-dismissed' }).draft).toBeNull();
		expect(mintFlowReducer(resumed, { type: 'draft-loaded', draft: null }).draft).toBeNull();
	});

	it('clears the last result and error when new inputs arrive', () => {
		const minted = reduce(
			mintFlowState(null),
			{ type: 'mint-started', mode: 'asset' },
			{ type: 'asset-minted', asset },
			{ type: 'collection-minted', result: collection }
		);
		expect(mintFlowReducer(minted, { type: 'file-selected' })).toMatchObject({ assetResult: null, error: null });
		expect(mintFlowReducer(minted, { type: 'collection-files-selected', error: 'Too many' })).toMatchObject({
			collectionResult: null,
			error: 'Too many',
		});

		const restarted = mintFlowReducer(mintFlowReducer(minted, { type: 'fungible-minted', result: token }), {
			type: 'mint-started',
			mode: 'asset',
		});
		expect(restarted).toMatchObject({ assetResult: null, collectionResult: null, fungible: { status: 'idle' } });
	});

	it('ignores stray events that do not apply to the current stage', () => {
		const idle = mintFlowState(null);
		expect(mintFlowReducer(idle, { type: 'fungible-phase', phase: 'signing' })).toBe(idle);
		expect(mintFlowReducer(idle, { type: 'fungible-error-cleared' })).toBe(idle);
		expect(mintFlowReducer(idle, { type: 'error-changed', error: null })).toBe(idle);
		expect(mintFlowReducer(idle, { type: 'fungible-dialog-changed', visible: false })).toBe(idle);
		expect(mintFlowReducer(idle, { type: 'fungible-dialog-changed', visible: true }).fungibleDialogVisible).toBe(
			true
		);
		expect(mintPhaseLabel(idle)).toBe('');
		expect(mintReceiptEntries(idle)).toEqual([]);
		expect(mintResultPath(idle)).toBeNull();
	});
});

describe('token panel view', () => {
	it('falls back to the typed name and ticker until the token exists', () => {
		expect(fungibleMintView(null, '  ', '  ')).toEqual({
			tokenName: 'Fungible token',
			tokenTicker: 'TKN',
			receiptEntries: [],
			tokenPath: null,
			dispatchPath: null,
		});
		expect(fungibleMintView(null, ' Draft ', ' DRF ')).toMatchObject({
			tokenName: 'Draft',
			tokenTicker: 'DRF',
		});
	});

	it('lists the minted token transactions and its routes', () => {
		const view = fungibleMintView(token, 'ignored', 'ignored');
		expect(view).toMatchObject({ tokenName: 'Signal', tokenTicker: 'SIG', dispatchPath: `/dispatch/${PROCESS}` });
		expect(view.receiptEntries).toEqual([
			{ label: 'Token logo transaction', transactionId: token.logo },
			{ label: 'Token process transaction', transactionId: PROCESS },
		]);
		expect(view.tokenPath).toContain(`/${PROCESS}`);
		expect(fungibleMintView({ ...token, logo: undefined }, '', '').receiptEntries).toHaveLength(1);
	});
});

describe('estimate discarding', () => {
	it('keeps reporting a request in flight and otherwise forgets the estimate', () => {
		expect(discardEstimate(IDLE)).toEqual(IDLE);
		expect(discardEstimate({ status: 'success', data: 1 })).toEqual(IDLE);
		expect(discardEstimate({ status: 'stale', data: 1, error: { reason: 'unknown' } as never })).toEqual(IDLE);
		expect(discardEstimate(LOADING)).toEqual(LOADING);
		expect(discardEstimate({ status: 'refreshing', data: 1 })).toEqual(LOADING);
	});

	it('scopes an upload activity to its owner and start time', () => {
		expect(mintUploadId(OWNER, 1234)).toBe(`upload:${OWNER}:1234`);
	});
});
