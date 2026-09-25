import React from 'react';

import { type AssetSummary, type Collection, collectionAsset } from 'api/collections';
import {
	type CollectionActivityEvent,
	discoverCollectionActivity,
	discoverCollectionActivityBatched,
	loadMarketActivity,
	saveMarketActivity,
} from 'api/discovery';

import {
	collectionCandidateMembership,
	newestCollectionActivity,
	retainNewestCollectionActivity,
} from 'features/Activity';
import type { AppError } from 'helpers/app-error';
import { asyncData, asyncError, isAsyncPending } from 'helpers/async-state';

import {
	collectionActivityReducer,
	type CollectionActivityRunMode,
	collectionActivityScope,
	INITIAL_COLLECTION_ACTIVITY,
	planCollectionActivityScan,
} from '../model/collection-activity';
import { collectionAssetWindowVersion, collectionIndexFailure } from '../model/collection-market';

const NO_EVENTS: CollectionActivityEvent[] = [];

export type CollectionActivityView = {
	/** Changes when the collection's activity window is replaced rather than extended. */
	scope: string;
	events: CollectionActivityEvent[];
	loading: boolean;
	error: AppError | undefined;
	pages: number;
	preserving: boolean;
	retry(): void;
	resolveAsset(event: CollectionActivityEvent): AssetSummary | undefined;
};

/**
 * Indexed market activity for one collection: cached events render first, then Arweave discovery refreshes them,
 * continuing from the assets already read when the collection window grows or a retry asks for the missing ones.
 */
export function useCollectionActivity(collection: Collection | undefined): CollectionActivityView {
	const [state, dispatch] = React.useReducer(collectionActivityReducer, INITIAL_COLLECTION_ACTIVITY);
	const [attempt, setAttempt] = React.useState(0);
	const eventsRef = React.useRef<CollectionActivityEvent[]>([]);
	const batchEvents = React.useRef(new Map<string, CollectionActivityEvent>());
	const loadedAssetIds = React.useRef(new Set<string>());
	const runMode = React.useRef<CollectionActivityRunMode>('refresh');
	const scopeRef = React.useRef('');
	// Discovery is keyed by scope and asset window; catalogue updates within them must not restart it.
	const collectionRef = React.useRef(collection);
	collectionRef.current = collection;
	const scope = React.useMemo(() => (collection ? collectionActivityScope(collection) : ''), [collection]);
	const windowVersion = React.useMemo(() => collectionAssetWindowVersion(collection?.assets), [collection?.assets]);

	React.useEffect(() => {
		const current = collectionRef.current;
		if (!current) return;
		const controller = new AbortController();
		const includesCollectionAsset = collectionCandidateMembership(current);
		const sameScope = scopeRef.current === scope;
		let cachedEvents: CollectionActivityEvent[] = [];
		if (!sameScope) {
			try {
				cachedEvents = loadMarketActivity(window.localStorage, scope).filter((event) =>
					includesCollectionAsset(event.processId)
				);
			} catch {
				// Browser storage is optional; live Arweave discovery continues below.
			}
		}
		const plan = planCollectionActivityScan({
			kind: current.kind,
			sameScope,
			runMode: runMode.current,
			assetIds: current.assets.map((asset) => asset.id),
			loadedAssetIds: loadedAssetIds.current,
			currentEvents: eventsRef.current,
			cachedEvents,
		});
		let nextEvents = newestCollectionActivity(plan.initialEvents);
		scopeRef.current = scope;
		runMode.current = 'refresh';
		if (!plan.incremental) {
			batchEvents.current.clear();
			loadedAssetIds.current.clear();
			retainNewestCollectionActivity(batchEvents.current, plan.initialEvents);
		}
		eventsRef.current = plan.initialEvents.length ? plan.initialEvents : [];
		dispatch({ type: 'scan-started', events: eventsRef.current });
		const discovery =
			current.kind === 'names'
				? discoverCollectionActivity({
						signal: controller.signal,
						limit: 100,
						acceptProcessId: includesCollectionAsset,
						requiredExecutionDevice: 'carrier@1.0',
						onPage: (page) => {
							if (controller.signal.aborted) return;
							nextEvents = newestCollectionActivity([...nextEvents, ...page]);
							eventsRef.current = nextEvents;
							dispatch({ type: 'page-loaded', events: nextEvents });
						},
				  })
				: discoverCollectionActivityBatched({
						signal: controller.signal,
						limit: 100,
						recipients: plan.recipients,
						onBatch: (events, completedRecipients) => {
							if (controller.signal.aborted || scopeRef.current !== scope) return;
							for (const assetId of completedRecipients) loadedAssetIds.current.add(assetId);
							eventsRef.current = retainNewestCollectionActivity(batchEvents.current, events);
							dispatch({ type: 'page-loaded', events: eventsRef.current });
						},
				  });
		void discovery.then(
			() => {
				if (controller.signal.aborted) return;
				eventsRef.current =
					current.kind === 'names'
						? newestCollectionActivity(nextEvents)
						: newestCollectionActivity([...batchEvents.current.values()]);
				try {
					saveMarketActivity(window.localStorage, scope, eventsRef.current);
				} catch {
					// The live result remains available when storage is unavailable.
				}
				dispatch({ type: 'scan-completed', events: eventsRef.current });
			},
			(cause) => {
				if (!controller.signal.aborted) dispatch({ type: 'scan-failed', error: collectionIndexFailure(cause) });
			}
		);
		return () => controller.abort();
	}, [scope, windowVersion, attempt]);

	const resolveAsset = React.useCallback(
		(event: CollectionActivityEvent) => (collection ? collectionAsset(collection, event.processId) : undefined),
		[collection]
	);

	return {
		scope,
		events: asyncData(state.events) ?? NO_EVENTS,
		loading: isAsyncPending(state.events),
		error: asyncError(state.events),
		pages: state.pages,
		preserving: state.preserving,
		retry: () => {
			runMode.current = 'retry';
			setAttempt((current) => current + 1);
		},
		resolveAsset,
	};
}
