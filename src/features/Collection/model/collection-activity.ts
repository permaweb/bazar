import type { Collection } from 'api/collections';
import type { CollectionActivityEvent } from 'api/discovery';

import { collectionActivityVersion, collectionAssetWindowDelta } from 'features/Activity';
import type { AppError } from 'helpers/app-error';
import { type AsyncState, failLoad, LOADING } from 'helpers/async-state';

import { replaceAsyncData } from './async-data';

export type CollectionActivityRunMode = 'refresh' | 'retry';

export type CollectionActivityState = {
	events: AsyncState<CollectionActivityEvent[]>;
	/** Index pages or recipient batches read in the current pass. */
	pages: number;
	/** The current pass started with events already on screen. */
	preserving: boolean;
};

export type CollectionActivityTransition =
	/** A pass starts, showing these events (cached or already loaded) until it finishes. */
	| { type: 'scan-started'; events: CollectionActivityEvent[] }
	| { type: 'page-loaded'; events: CollectionActivityEvent[] }
	| { type: 'scan-completed'; events: CollectionActivityEvent[] }
	| { type: 'scan-failed'; error: AppError };

export type CollectionActivityScanPlan = {
	/** Read only the assets missing from the previous pass instead of starting over. */
	incremental: boolean;
	initialEvents: CollectionActivityEvent[];
	recipients: string[];
};

export const INITIAL_COLLECTION_ACTIVITY: CollectionActivityState = { events: LOADING, pages: 0, preserving: false };

export function collectionActivityReducer(
	state: CollectionActivityState,
	transition: CollectionActivityTransition
): CollectionActivityState {
	switch (transition.type) {
		case 'scan-started': {
			const preserving = transition.events.length > 0;
			return {
				events: preserving ? { status: 'refreshing', data: transition.events } : LOADING,
				pages: 0,
				preserving,
			};
		}
		case 'page-loaded':
			return { ...state, events: replaceAsyncData(state.events, transition.events), pages: state.pages + 1 };
		case 'scan-completed':
			return { ...state, events: { status: 'success', data: transition.events }, preserving: false };
		case 'scan-failed':
			return { ...state, events: failLoad(state.events, transition.error) };
	}
}

/** Cache and continuation scope: the name index version, or the collection manifest. */
export function collectionActivityScope(collection: Collection): string {
	return `${collection.id}:${
		collection.kind === 'names' ? collectionActivityVersion(collection) : collection.manifestId ?? collection.id
	}`;
}

/**
 * Decide how an activity pass starts. Recipient-batched collections continue a pass in the same scope when assets
 * were added or a retry asks for the assets that failed; otherwise the pass starts over from cached or current events.
 */
export function planCollectionActivityScan(input: {
	kind: Collection['kind'];
	sameScope: boolean;
	runMode: CollectionActivityRunMode;
	assetIds: string[];
	loadedAssetIds: ReadonlySet<string>;
	currentEvents: CollectionActivityEvent[];
	cachedEvents: CollectionActivityEvent[];
}): CollectionActivityScanPlan {
	const window = collectionAssetWindowDelta(input.loadedAssetIds, input.assetIds);
	const batched = input.kind !== 'names' && input.sameScope && !window.reset;
	const incremental = batched && (input.runMode === 'retry' || window.added.length > 0);
	return {
		incremental,
		initialEvents: input.sameScope && input.currentEvents.length ? input.currentEvents : input.cachedEvents,
		recipients: incremental
			? input.assetIds.filter((assetId) => !input.loadedAssetIds.has(assetId))
			: input.assetIds,
	};
}
