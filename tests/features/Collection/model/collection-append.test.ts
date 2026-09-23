import { describe, expect, it } from 'vitest';

import type { CollectionMintEstimate, MintedCollection } from 'api/mint';

import {
	appendedCollectionAssetIds,
	COLLECTION_APPEND_FILE_LIMIT,
	type CollectionAppendEvent,
	collectionAppendReducer,
	collectionAppendSource,
	type CollectionAppendState,
	INITIAL_COLLECTION_APPEND,
} from 'features/Collection/model/collection-append';
import { appError } from 'helpers/app-error';

import { assetSummary, collectionFixture } from '../../../fixtures/collection';

const estimate: CollectionMintEstimate = { assetCount: 2, total: 42n, transactionCount: 3 };
const failure = appError('unknown');

function file(name: string): File {
	return { name, size: name.length } as File;
}

function reduce(state: CollectionAppendState, ...events: CollectionAppendEvent[]) {
	return events.reduce(collectionAppendReducer, state);
}

const chosen = reduce(INITIAL_COLLECTION_APPEND, { type: 'opened' }, { type: 'files-selected', files: [file('a')] });

describe('collection append flow', () => {
	it('opens and closes the dialog while the selection survives', () => {
		expect(chosen.open).toBe(true);
		const closed = reduce(chosen, { type: 'closed' });
		expect(closed.open).toBe(false);
		expect(closed.files).toBe(chosen.files);
		expect(reduce(closed, { type: 'closed' })).toBe(closed);
		expect(reduce(chosen, { type: 'opened' })).toBe(chosen);
	});

	it('accepts at most ten files and clears the last failure', () => {
		const many = Array.from({ length: 12 }, (_, index) => file(`file-${index}`));
		const state = reduce(
			chosen,
			{ type: 'estimate-failed', error: failure },
			{ type: 'files-selected', files: many }
		);
		expect(state.files).toHaveLength(COLLECTION_APPEND_FILE_LIMIT);
		expect(state.error).toBeNull();
	});

	it('keeps the previous estimate visible while a new one is read, and after it fails', () => {
		const loaded = reduce(chosen, { type: 'estimate-started' }, { type: 'estimate-loaded', estimate });
		expect(loaded.estimate).toEqual({ status: 'success', data: estimate });
		const refreshing = reduce(loaded, { type: 'estimate-started' });
		expect(refreshing.estimate).toEqual({ status: 'refreshing', data: estimate });
		const failed = reduce(refreshing, { type: 'estimate-failed', error: failure });
		expect(failed.estimate).toEqual({ status: 'stale', data: estimate, error: failure });
		expect(failed.error).toBe(failure);
	});

	it('forgets the estimate when there is nothing to estimate', () => {
		const loaded = reduce(chosen, { type: 'estimate-started' }, { type: 'estimate-loaded', estimate });
		const cleared = reduce(loaded, { type: 'estimate-cleared' });
		expect(cleared.estimate).toEqual({ status: 'idle' });
		expect(reduce(cleared, { type: 'estimate-cleared' })).toBe(cleared);
	});

	it('reports each signing and upload phase, then clears the dialog on success', () => {
		const submitting = reduce(
			chosen,
			{ type: 'estimate-started' },
			{ type: 'estimate-loaded', estimate },
			{ type: 'submit-started' },
			{ type: 'submit-progressed', progress: 'Asset 1 of 2 · Approve in your wallet' }
		);
		expect(submitting.submission).toEqual({
			status: 'submitting',
			progress: 'Asset 1 of 2 · Approve in your wallet',
		});
		const succeeded = reduce(submitting, { type: 'submit-succeeded' });
		expect(succeeded).toEqual({
			open: false,
			files: [],
			estimate: { status: 'idle' },
			submission: { status: 'idle' },
			error: null,
		});
	});

	it('keeps the dialog and its selection open when a submission fails', () => {
		const submitting = reduce(chosen, { type: 'submit-started' });
		const failed = reduce(submitting, { type: 'submit-failed', error: failure });
		expect(failed.submission).toEqual({ status: 'idle' });
		expect(failed.error).toBe(failure);
		expect(failed.open).toBe(true);
		expect(failed.files).toBe(chosen.files);
	});

	it('ignores closing, reselecting, and resubmitting while a submission runs', () => {
		const submitting = reduce(chosen, { type: 'submit-started' });
		expect(reduce(submitting, { type: 'closed' })).toBe(submitting);
		expect(reduce(submitting, { type: 'files-selected', files: [file('b')] })).toBe(submitting);
		expect(reduce(submitting, { type: 'submit-started' })).toBe(submitting);
		expect(reduce(INITIAL_COLLECTION_APPEND, { type: 'submit-progressed', progress: 'x' })).toBe(
			INITIAL_COLLECTION_APPEND
		);
	});
});

describe('collection append inputs', () => {
	it('extends the minted record with the catalogue entry, keeping ownership and the newest manifest', () => {
		const owned: MintedCollection = {
			...collectionFixture([assetSummary(1)]),
			manifestId: 'minted-manifest',
			owner: 'owner',
			createdAt: 7,
		};
		const catalogue = collectionFixture([assetSummary(1), assetSummary(2)], {
			name: 'Renamed',
			manifestId: 'catalogue-manifest',
		});
		expect(collectionAppendSource(owned, catalogue)).toMatchObject({
			name: 'Renamed',
			owner: 'owner',
			createdAt: 7,
			manifestId: 'catalogue-manifest',
			assets: catalogue.assets,
		});
		expect(collectionAppendSource(owned, { ...catalogue, manifestId: undefined }).manifestId).toBe(
			'minted-manifest'
		);
	});

	it('reports only the assets an append added', () => {
		const before = collectionFixture([assetSummary(1)]);
		const after = collectionFixture([assetSummary(1), assetSummary(2), assetSummary(3)]);
		expect(appendedCollectionAssetIds(before, after)).toEqual([assetSummary(2).id, assetSummary(3).id]);
		expect(appendedCollectionAssetIds(after, after)).toEqual([]);
	});
});
