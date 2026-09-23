// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { MintDraft, MintedAsset } from 'api/mint';

import { useAssetCreator } from 'features/Create/hooks/useAssetCreator';
import { MINT_ESTIMATE_DEBOUNCE_MS } from 'features/Create/hooks/useMintEstimate';

import { renderHook } from '../../../test-utils/hook-renderer';

const mocks = vi.hoisted(() => ({
	wallet: { address: null as string | null, openConnectDialog: vi.fn() },
	market: { addCreatedAsset: vi.fn(), addCollection: vi.fn() },
	uploads: {
		beginUpload: vi.fn(),
		updateUpload: vi.fn(),
		recordUploadTransaction: vi.fn(),
		finishUpload: vi.fn(),
		failUpload: vi.fn(),
	},
	estimate: vi.fn(),
	estimateFungible: vi.fn(),
	mint: vi.fn(),
	mintFungible: vi.fn(),
	resume: vi.fn(),
	estimateCollection: vi.fn(),
	mintCollection: vi.fn(),
	getMintDraft: vi.fn(),
	discardMintDraft: vi.fn(),
	confirmTransactionId: vi.fn(),
}));

vi.mock('providers/WalletProvider', () => ({ useWallet: () => mocks.wallet }));
vi.mock('providers/MarketProvider', () => ({ useMarketProvider: () => mocks.market }));
vi.mock('providers/OperationActivityProvider', () => ({ useOperationActivity: () => mocks.uploads }));
vi.mock('api/transactions', () => ({ confirmTransactionId: mocks.confirmTransactionId }));
vi.mock('api/mint', async (importOriginal) => ({
	...(await importOriginal<typeof import('api/mint')>()),
	getMintDraft: mocks.getMintDraft,
	discardMintDraft: mocks.discardMintDraft,
	AssetMintClient: class {
		estimate = mocks.estimate;
		estimateFungible = mocks.estimateFungible;
		mint = mocks.mint;
		mintFungible = mocks.mintFungible;
		resume = mocks.resume;
	},
	CollectionMintClient: class {
		estimate = mocks.estimateCollection;
		mint = mocks.mintCollection;
	},
}));

const OWNER = 'O'.repeat(43);
const LOGO_ID = 'L'.repeat(43);
const PROCESS = 'P'.repeat(43);

const image = new File([new Uint8Array(8)], 'cover.png', { type: 'image/png' });

const minted: MintedAsset = {
	id: 'A'.repeat(43),
	name: 'cover',
	contentType: 'image/png',
	description: '',
	mediaId: 'M'.repeat(43),
	owner: OWNER,
	createdAt: 1,
};

const draft: MintDraft = {
	owner: OWNER,
	name: 'Saved mint',
	description: '',
	contentType: 'image/png',
	mediaId: 'M'.repeat(43),
	createdAt: 1,
};

function render() {
	return renderHook(() => useAssetCreator(), undefined);
}

async function settle() {
	await React.act(async () => {
		await vi.advanceTimersByTimeAsync(MINT_ESTIMATE_DEBOUNCE_MS);
	});
}

beforeEach(() => {
	vi.useFakeTimers();
	URL.createObjectURL = vi.fn(() => 'blob:preview');
	URL.revokeObjectURL = vi.fn();
	mocks.wallet.address = OWNER;
	for (const mock of [
		mocks.wallet.openConnectDialog,
		mocks.market.addCreatedAsset,
		mocks.market.addCollection,
		...Object.values(mocks.uploads),
		mocks.estimate,
		mocks.estimateFungible,
		mocks.mint,
		mocks.mintFungible,
		mocks.resume,
		mocks.estimateCollection,
		mocks.mintCollection,
		mocks.getMintDraft,
		mocks.discardMintDraft,
		mocks.confirmTransactionId,
	]) {
		mock.mockReset();
	}
	mocks.getMintDraft.mockReturnValue(null);
	mocks.estimate.mockResolvedValue({
		assetReward: 10n,
		artworkReward: 0n,
		total: 10n,
		assetBytes: 8,
		artworkBytes: 0,
		transactionCount: 1,
	});
	mocks.confirmTransactionId.mockReturnValue(new Promise(() => undefined));
});

afterEach(() => {
	vi.useRealTimers();
	document.body.innerHTML = '';
});

describe('useAssetCreator', () => {
	it('asks for a wallet instead of minting when none is connected', async () => {
		mocks.wallet.address = null;
		const hook = render();
		await React.act(() => hook.current().mint());
		expect(mocks.wallet.openConnectDialog).toHaveBeenCalled();
		expect(mocks.uploads.beginUpload).not.toHaveBeenCalled();
		expect(mocks.mint).not.toHaveBeenCalled();
		hook.unmount();
	});

	it('refuses to mint an asset without a file and never starts an upload activity', async () => {
		const hook = render();
		await React.act(() => hook.current().mint());
		expect(hook.current().flow.error).toBe('Choose an image, MP3, or WAV file to continue.');
		expect(mocks.uploads.beginUpload).not.toHaveBeenCalled();
		hook.unmount();
	});

	it('estimates the selected asset after the inputs settle', async () => {
		const hook = render();
		React.act(() => hook.current().selectFile(image));
		expect(hook.current().fields.file).toBe(image);
		expect(hook.current().fields.name).toBe('cover');
		expect(mocks.estimate).not.toHaveBeenCalled();

		await settle();
		expect(mocks.estimate).toHaveBeenCalledWith(
			expect.objectContaining({ file: image, name: 'cover' }),
			expect.any(AbortSignal)
		);
		expect(hook.current().estimates.asset).toMatchObject({ status: 'success' });
		expect(hook.current().estimates.estimating).toBe(false);
		expect(hook.current().cost.estimate?.total).toBe(10n);
		expect(hook.current().submitDisabled).toBe(false);
		hook.unmount();
	});

	it('mints the asset, reports every stage to the upload activity, and shows the result', async () => {
		mocks.mint.mockImplementation(async (_input, _owner, options) => {
			options.onTransaction({ id: 'T'.repeat(43), label: 'Asset transaction' });
			options.onPhase('signing-asset');
			options.onPhase('uploading-asset');
			return { asset: minted, mediaId: minted.mediaId, processId: minted.id };
		});
		const hook = render();
		React.act(() => hook.current().selectFile(image));
		await settle();

		await React.act(() => hook.current().mint());
		const uploadId: string = mocks.uploads.beginUpload.mock.calls[0][0].id;
		expect(uploadId.startsWith(`upload:${OWNER}:`)).toBe(true);
		expect(mocks.uploads.beginUpload).toHaveBeenCalledWith(
			expect.objectContaining({ owner: OWNER, kind: 'asset', name: 'cover' })
		);
		expect(mocks.uploads.recordUploadTransaction).toHaveBeenCalledWith(uploadId, {
			id: 'T'.repeat(43),
			label: 'Asset transaction',
		});
		expect(mocks.uploads.updateUpload).toHaveBeenCalledWith(
			uploadId,
			'Waiting for approval of the atomic asset in your wallet…'
		);
		expect(mocks.market.addCreatedAsset).toHaveBeenCalledWith(minted);
		expect(mocks.uploads.finishUpload).toHaveBeenCalledWith(
			uploadId,
			expect.objectContaining({ assetId: minted.id })
		);
		expect(hook.current().flow.assetResult).toBe(minted);
		expect(hook.current().working).toBe(false);
		expect(hook.current().assetResultLive).toBe(false);
		hook.unmount();
	});

	it('keeps the saved draft and the failure message when a mint fails', async () => {
		mocks.mint.mockRejectedValue(new Error('gateway rejected the upload'));
		mocks.getMintDraft.mockReturnValue(draft);
		const hook = render();
		React.act(() => hook.current().selectFile(image));
		await settle();
		await React.act(() => hook.current().mint());

		expect(hook.current().flow.error).toBe(
			'Something went wrong. Retry, and reload the page if the problem continues.'
		);
		expect(hook.current().flow.draft).toBe(draft);
		expect(mocks.uploads.failUpload).toHaveBeenCalledWith(
			mocks.uploads.beginUpload.mock.calls[0][0].id,
			hook.current().flow.error
		);
		expect(hook.current().working).toBe(false);
		hook.unmount();
	});

	it('finishes a saved draft and dismisses it without signing', async () => {
		mocks.getMintDraft.mockReturnValue(draft);
		mocks.resume.mockResolvedValue({ asset: minted, mediaId: minted.mediaId, processId: minted.id });
		const hook = render();
		expect(hook.current().flow.draft).toBe(draft);

		await React.act(() => hook.current().resume());
		expect(mocks.resume).toHaveBeenCalledWith(draft, OWNER, expect.any(Object));
		expect(hook.current().flow.draft).toBeNull();
		expect(hook.current().flow.assetResult).toBe(minted);

		mocks.getMintDraft.mockReturnValue(draft);
		const next = render();
		React.act(() => next.current().dismissDraft());
		expect(mocks.discardMintDraft).toHaveBeenCalledWith(OWNER);
		expect(next.current().flow.draft).toBeNull();
		hook.unmount();
		next.unmount();
	});

	it('opens the token panel for a token mint and records its logo transaction', async () => {
		mocks.estimateFungible.mockResolvedValue({
			processReward: 1n,
			logoReward: 0n,
			reward: 1n,
			bytes: 10,
			transactionCount: 1,
		});
		mocks.mintFungible.mockImplementation(async (_input, _owner, options) => {
			options.onPhase('signing-logo');
			options.onLogoUploaded(LOGO_ID);
			options.onPhase('signing');
			return {
				processId: PROCESS,
				logo: LOGO_ID,
				owner: OWNER,
				name: 'Signal',
				ticker: 'SIG',
				wholeSupply: '1000',
				atomicSupply: '1000000000000000',
				denomination: 12,
				createdAt: 1,
			};
		});
		const hook = render();
		React.act(() => {
			hook.current().setMode('fungible');
			hook.current().setName('Signal');
			hook.current().setTicker('SIG');
			hook.current().setWholeSupply('1000');
		});
		await settle();
		expect(mocks.estimateFungible).toHaveBeenCalled();

		await React.act(() => hook.current().mint());
		expect(mocks.uploads.beginUpload).not.toHaveBeenCalled();
		expect(hook.current().flow.fungibleDialogVisible).toBe(true);
		expect(hook.current().flow.fungible).toEqual({
			status: 'minted',
			result: expect.objectContaining({ processId: PROCESS }),
		});
		expect(hook.current().fields.logoTxId).toBe(LOGO_ID);
		expect(mocks.confirmTransactionId).toHaveBeenCalledWith(PROCESS, expect.objectContaining({ target: 5 }));
		hook.unmount();
	});

	it('reports a rejected token logo and keeps the file input clearable', () => {
		const hook = render();
		let accepted = true;
		React.act(() => {
			accepted = hook.current().selectLogo(new File([new Uint8Array(4)], 'logo.svg', { type: 'image/svg+xml' }));
		});
		expect(accepted).toBe(false);
		expect(hook.current().fields.logo).toBeNull();
		expect(hook.current().flow.error).toBe('Use a PNG, JPG, WebP, or GIF image for the token logo.');

		React.act(() => {
			accepted = hook.current().selectLogo(image);
		});
		expect(accepted).toBe(true);
		expect(hook.current().fields.logo).toBe(image);
		expect(hook.current().flow.error).toBeNull();
		hook.unmount();
	});

	it('caps a collection at ten images and explains the limit', () => {
		const hook = render();
		const files = Array.from({ length: 12 }, (_, index) => new File([new Uint8Array(2)], `${index}.png`));
		React.act(() => hook.current().selectCollectionFiles(files));
		expect(hook.current().fields.collectionFiles).toHaveLength(10);
		expect(hook.current().flow.error).toBe('Collections support up to 10 images at a time.');

		React.act(() => hook.current().removeCollectionFile(0));
		expect(hook.current().fields.collectionFiles).toHaveLength(9);
		expect(hook.current().flow.error).toBeNull();
		hook.unmount();
	});
});
