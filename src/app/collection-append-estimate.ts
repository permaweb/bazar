import type { CollectionMintEstimate } from 'api/asset-mint';

/**
 * The storage-cost estimate in the owner's "Add assets" dialog. One value
 * replaces the old estimate / estimating / shared-error slots, so a total for
 * different files can never sit beside "Checking…", and an estimate failure
 * never shares a slot with an append (submit) failure.
 */
export type CollectionAppendEstimateState =
	| { status: 'idle' }
	| { status: 'checking' }
	| { status: 'ready'; estimate: CollectionMintEstimate }
	| { status: 'failed'; message: string };

export type CollectionAppendEstimateEvent =
	| { type: 'reset' }
	| { type: 'start' }
	| { type: 'resolve'; estimate: CollectionMintEstimate }
	| { type: 'reject'; message: string };

export const idleCollectionAppendEstimate: CollectionAppendEstimateState = { status: 'idle' };

export function collectionAppendEstimateReducer(
	state: CollectionAppendEstimateState,
	event: CollectionAppendEstimateEvent
): CollectionAppendEstimateState {
	switch (event.type) {
		case 'reset':
			return state.status === 'idle' ? state : idleCollectionAppendEstimate;
		case 'start':
			// A new run always drops the previous total: it priced different inputs.
			return state.status === 'checking' ? state : { status: 'checking' };
		case 'resolve':
			// Only the run in flight may settle; a late answer after a reset is ignored.
			return state.status === 'checking' ? { status: 'ready', estimate: event.estimate } : state;
		case 'reject':
			return state.status === 'checking' ? { status: 'failed', message: event.message } : state;
	}
}

/**
 * The append runs with allowHighCost, so a fresh total for exactly these files
 * is the only cost the owner sees before the wallet prompts. Submit needs that
 * total and no append already running. An earlier append failure does not
 * block a retry while the estimate is still fresh.
 */
export function collectionAppendCanSubmit({
	estimate,
	files,
	working,
}: {
	estimate: CollectionAppendEstimateState;
	files: readonly File[];
	working: boolean;
}) {
	return files.length > 0 && estimate.status === 'ready' && !working;
}
