import React from 'react';

import type { Collection } from 'api/collections';
import { discoverCollectionActivityBatched } from 'api/discovery';

import { mapConcurrent } from 'helpers/concurrency';

import type { HomeListingActivity } from '../model/home-market';
import { homeCollectionActivityKey } from '../model/home-market-view';

/**
 * Finds each visible collection's latest indexed market action so Collections can sort by recent activity. Two
 * collections are read at a time, in their current order; a newer event replaces an older one per collection.
 * Activity indexing is best-effort: when it is unavailable, creation time remains a truthful fallback.
 */
export function useHomeCollectionActivity(options: {
	active: boolean;
	collections: Collection[];
	onActivity(update: { collectionId: string; activity: HomeListingActivity }): void;
}): void {
	const onActivity = options.onActivity;
	const activityKey = React.useMemo(() => homeCollectionActivityKey(options.collections), [options.collections]);
	// Reads restart only when the collections or their asset windows change, not when sorting reorders them.
	const collectionsRef = React.useRef(options.collections);
	collectionsRef.current = options.collections;

	React.useEffect(() => {
		if (!options.active) return;
		const controller = new AbortController();
		void mapConcurrent(collectionsRef.current, 2, async (collection) => {
			// An abort leaves the remaining collections unread; teardown settles without rejecting the scan.
			if (controller.signal.aborted) return;
			try {
				const events = await discoverCollectionActivityBatched({
					limit: 1,
					recipients: collection.assets.map((asset) => asset.id),
					signal: controller.signal,
				});
				const latest = events[0];
				if (!latest || controller.signal.aborted) return;
				onActivity({ collectionId: collection.id, activity: latest });
			} catch {
				// Creation time remains a truthful fallback when activity indexing is unavailable.
			}
		});
		return () => controller.abort();
	}, [activityKey, onActivity, options.active]);
}
