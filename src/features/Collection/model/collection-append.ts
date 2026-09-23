import type { Collection } from 'api/collections';
import type { CollectionMintEstimate, MintedCollection } from 'api/mint';

import type { AppError } from 'helpers/app-error';
import { type AsyncState, beginLoad, failLoad, IDLE } from 'helpers/async-state';

export const COLLECTION_APPEND_FILE_LIMIT = 10;

export type CollectionAppendSubmission = { status: 'idle' } | { status: 'submitting'; progress: string };

/** Adding images to a collection the connected wallet minted: choose files, estimate storage, then sign and upload. */
export type CollectionAppendState = {
	open: boolean;
	files: File[];
	estimate: AsyncState<CollectionMintEstimate>;
	submission: CollectionAppendSubmission;
	/** The latest estimate or submission failure, cleared by a new selection or submission. */
	error: AppError | null;
};

export type CollectionAppendEvent =
	| { type: 'opened' }
	| { type: 'closed' }
	| { type: 'files-selected'; files: readonly File[] }
	/** Nothing to estimate: the dialog is closed, empty, or the collection is not the wallet's. */
	| { type: 'estimate-cleared' }
	| { type: 'estimate-started' }
	| { type: 'estimate-loaded'; estimate: CollectionMintEstimate }
	| { type: 'estimate-failed'; error: AppError }
	| { type: 'submit-started' }
	| { type: 'submit-progressed'; progress: string }
	| { type: 'submit-succeeded' }
	| { type: 'submit-failed'; error: AppError };

export const INITIAL_COLLECTION_APPEND: CollectionAppendState = {
	open: false,
	files: [],
	estimate: IDLE,
	submission: { status: 'idle' },
	error: null,
};

export function collectionAppendReducer(
	state: CollectionAppendState,
	event: CollectionAppendEvent
): CollectionAppendState {
	const submitting = state.submission.status === 'submitting';
	switch (event.type) {
		case 'opened':
			return state.open ? state : { ...state, open: true };
		case 'closed':
			// Signing and uploading continue in the wallet, so the dialog stays open until they finish.
			return submitting || !state.open ? state : { ...state, open: false };
		case 'files-selected':
			return submitting
				? state
				: { ...state, files: event.files.slice(0, COLLECTION_APPEND_FILE_LIMIT), error: null };
		case 'estimate-cleared':
			return state.estimate.status === 'idle' ? state : { ...state, estimate: IDLE };
		case 'estimate-started':
			return { ...state, estimate: beginLoad(state.estimate) };
		case 'estimate-loaded':
			return { ...state, estimate: { status: 'success', data: event.estimate } };
		case 'estimate-failed':
			return { ...state, estimate: failLoad(state.estimate, event.error), error: event.error };
		case 'submit-started':
			return submitting ? state : { ...state, submission: { status: 'submitting', progress: '' }, error: null };
		case 'submit-progressed':
			return submitting ? { ...state, submission: { status: 'submitting', progress: event.progress } } : state;
		case 'submit-succeeded':
			return { ...state, open: false, files: [], estimate: IDLE, submission: { status: 'idle' } };
		case 'submit-failed':
			return { ...state, submission: { status: 'idle' }, error: event.error };
	}
}

/** The locally minted record, refreshed with the collection's current catalogue entry, that an append extends. */
export function collectionAppendSource(owned: MintedCollection, collection: Collection): MintedCollection {
	return {
		...owned,
		...collection,
		owner: owned.owner,
		createdAt: owned.createdAt,
		manifestId: collection.manifestId ?? owned.manifestId,
	};
}

export function appendedCollectionAssetIds(previous: Collection, next: Collection): string[] {
	const previousIds = new Set(previous.assets.map((asset) => asset.id));
	return next.assets.filter((asset) => !previousIds.has(asset.id)).map((asset) => asset.id);
}
