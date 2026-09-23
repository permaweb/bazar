// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	loadMintedCollections: vi.fn(),
	loadMintRuntime: vi.fn(),
	estimateAppend: vi.fn(),
	append: vi.fn(),
	addCollection: vi.fn(),
	beginUpload: vi.fn(),
	updateUpload: vi.fn(),
	recordUploadTransaction: vi.fn(),
	finishUpload: vi.fn(),
	failUpload: vi.fn(),
	address: { current: 'owner' as string | null },
}));

vi.mock('api/mint', async (importOriginal) => ({
	...(await importOriginal<typeof import('api/mint')>()),
	loadMintedCollections: mocks.loadMintedCollections,
	loadMintRuntime: mocks.loadMintRuntime,
}));
vi.mock('providers/MarketProvider', () => ({ useMarketProvider: () => ({ addCollection: mocks.addCollection }) }));
vi.mock('providers/WalletProvider', () => ({ useWallet: () => ({ address: mocks.address.current }) }));
vi.mock('providers/OperationActivityProvider', () => ({
	useOperationActivity: () => ({
		beginUpload: mocks.beginUpload,
		updateUpload: mocks.updateUpload,
		recordUploadTransaction: mocks.recordUploadTransaction,
		finishUpload: mocks.finishUpload,
		failUpload: mocks.failUpload,
	}),
}));

import type { Collection } from 'api/collections';
import type { CollectionMintEstimate, MintedCollection } from 'api/mint';

import { useCollectionAppend } from 'features/Collection/hooks/useCollectionAppend';
import { appError, appErrorMessage } from 'helpers/app-error';
import { APP_ERROR_MESSAGES } from 'helpers/app-error.messages';

import { assetSummary, collectionFixture } from '../../../fixtures/collection';
import { deferred, renderHook, settle } from '../../../test-utils/render-hook';

const collection = collectionFixture([assetSummary(1)], { name: 'Waves' });
const owned: MintedCollection = { ...collection, manifestId: 'manifest-a', owner: 'owner', createdAt: 5 };
const estimate: CollectionMintEstimate = { assetCount: 1, total: 42n, transactionCount: 2 };

function pngFile(name: string) {
	return new File([name], name, { type: 'image/png' });
}

function render(current: Collection | undefined = collection) {
	return renderHook(
		(props: { collection: Collection | undefined }) => useCollectionAppend('collection-a', props.collection),
		{
			collection: current,
		}
	);
}

async function openWithFiles(harness: ReturnType<typeof render>, files: File[] = [pngFile('a.png')]) {
	await settle(() => {
		harness.current().openDialog();
		harness.current().selectFiles(files as unknown as FileList);
	});
}

beforeEach(() => {
	for (const mock of Object.values(mocks)) {
		if (typeof mock === 'function') mock.mockReset();
	}
	mocks.address.current = 'owner';
	mocks.loadMintedCollections.mockReturnValue([owned]);
	mocks.loadMintRuntime.mockImplementation(async () => ({
		CollectionMintClient: class {
			estimateAppend = mocks.estimateAppend;
			append = mocks.append;
		},
	}));
	window.URL.createObjectURL = vi.fn(() => 'blob:preview');
	window.URL.revokeObjectURL = vi.fn();
});

describe('useCollectionAppend', () => {
	it('offers the append only for a collection this wallet minted', () => {
		const harness = render();
		expect(harness.current().canAppend).toBe(true);
		mocks.address.current = 'someone-else';
		harness.rerender({ collection });
		expect(harness.current().canAppend).toBe(false);
		harness.unmount();
	});

	it('estimates the selected files and keeps a preview for each', async () => {
		const request = deferred<CollectionMintEstimate>();
		mocks.estimateAppend.mockReturnValue(request.promise);
		const harness = render();
		await openWithFiles(harness, [pngFile('a.png'), pngFile('b.png')]);

		expect(harness.current().open).toBe(true);
		expect(harness.current().estimating).toBe(true);
		expect(harness.current().previews).toHaveLength(2);
		expect(mocks.estimateAppend).toHaveBeenCalledWith(owned, expect.any(Array), expect.any(AbortSignal));

		await settle(async () => {
			request.resolve(estimate);
			await request.promise;
		});
		expect(harness.current().estimating).toBe(false);
		expect(harness.current().estimate).toEqual(estimate);
		harness.unmount();
	});

	it('forgets the estimate when the selection is cleared', async () => {
		mocks.estimateAppend.mockResolvedValue(estimate);
		const harness = render();
		await openWithFiles(harness);
		await settle();
		expect(harness.current().estimate).toEqual(estimate);

		await settle(() => harness.current().selectFiles(null));
		expect(harness.current().estimate).toBeUndefined();
		expect(harness.current().estimating).toBe(false);
		harness.unmount();
	});

	it('keeps the last estimate visible while a new selection is estimated', async () => {
		mocks.estimateAppend.mockResolvedValueOnce(estimate);
		const harness = render();
		await openWithFiles(harness);
		await settle();

		const pending = deferred<CollectionMintEstimate>();
		mocks.estimateAppend.mockReturnValue(pending.promise);
		await settle(() => harness.current().selectFiles([pngFile('a.png'), pngFile('c.png')] as unknown as FileList));
		expect(harness.current().estimating).toBe(true);
		expect(harness.current().estimate).toEqual(estimate);

		await settle(async () => {
			pending.resolve({ ...estimate, assetCount: 2 });
			await pending.promise;
		});
		expect(harness.current().estimate).toMatchObject({ assetCount: 2 });
		harness.unmount();
	});

	it('uploads the files, records the upload, and closes the dialog on success', async () => {
		mocks.estimateAppend.mockResolvedValue(estimate);
		const extended = collectionFixture([assetSummary(1), assetSummary(2)], { name: 'Waves' });
		mocks.append.mockImplementation(async (_source, _files, _owner, options) => {
			options.onTransaction({ id: 'transaction' });
			options.onPhase({ kind: 'manifest', phase: 'signing' });
			return { collection: extended, manifestId: 'manifest-b', updateId: 'update-1' };
		});
		const harness = render();
		await openWithFiles(harness);
		await settle();

		await settle(() => harness.current().submit());
		expect(mocks.beginUpload).toHaveBeenCalledWith(
			expect.objectContaining({ kind: 'collection', name: 'Waves additions', owner: 'owner' })
		);
		expect(mocks.updateUpload).toHaveBeenCalledWith(expect.any(String), 'Approve the new manifest');
		expect(mocks.recordUploadTransaction).toHaveBeenCalledWith(expect.any(String), { id: 'transaction' });
		expect(mocks.addCollection).toHaveBeenCalledWith(extended);
		expect(mocks.finishUpload).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({ assetIds: [assetSummary(2).id], transactionIds: ['manifest-b', 'update-1'] })
		);
		expect(harness.current().open).toBe(false);
		expect(harness.current().fileCount).toBe(0);
		expect(harness.current().submitting).toBe(false);
		harness.unmount();
	});

	it('keeps the dialog open and reports a failed append', async () => {
		mocks.estimateAppend.mockResolvedValue(estimate);
		const failure = appError('wallet-request-rejected');
		mocks.append.mockRejectedValue(failure);
		const harness = render();
		await openWithFiles(harness);
		await settle();

		await settle(() => harness.current().submit());
		expect(harness.current().error).toBe(failure);
		expect(harness.current().submitting).toBe(false);
		expect(harness.current().open).toBe(true);
		expect(harness.current().fileCount).toBe(1);
		expect(mocks.failUpload).toHaveBeenCalledWith(
			expect.any(String),
			appErrorMessage(APP_ERROR_MESSAGES.en, failure)
		);
		expect(mocks.addCollection).not.toHaveBeenCalled();
		harness.unmount();
	});

	it('never appends without a connected wallet or a minted collection', async () => {
		mocks.estimateAppend.mockResolvedValue(estimate);
		mocks.address.current = null;
		const harness = render();
		await openWithFiles(harness);
		await settle(() => harness.current().submit());
		expect(mocks.append).not.toHaveBeenCalled();
		expect(mocks.beginUpload).not.toHaveBeenCalled();

		mocks.estimateAppend.mockClear();
		mocks.loadMintedCollections.mockReturnValue([]);
		const withoutMint = render();
		await openWithFiles(withoutMint);
		expect(withoutMint.current().open).toBe(false);
		expect(mocks.estimateAppend).not.toHaveBeenCalled();
		harness.unmount();
		withoutMint.unmount();
	});
});
