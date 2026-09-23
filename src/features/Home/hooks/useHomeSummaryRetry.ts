import React from 'react';

import type { HomeListingFailure } from '../model/home-listing-scan';
import {
	completeHomeSummaryRetryGroup,
	type HomeSummaryRetryGroup,
	type HomeSummaryRetryRun,
	startHomeSummaryRetry,
} from '../model/home-market';

const HOME_SUMMARY_RETRY_DELAY_MS = 15_000;

export type HomeSummaryRetry = {
	// Increments whenever a retry starts; summary loaders rerun for it.
	attempt: number;
	assetsRetrying: boolean;
	collectionsRetrying: boolean;
	// Takes the keys a loader must refetch for this retry and the retry token it reports completion with.
	claim(group: HomeSummaryRetryGroup): { keys: ReadonlySet<string>; token: number | null };
	finish(token: number, group: HomeSummaryRetryGroup, activeRequests: number): void;
};

/**
 * Retries failed price and floor summaries 15 seconds after the set of visible failures last changed. Each retry is a
 * token-scoped run over the groups that failed; it ends once every group's loader has settled its requests. Retries
 * pause while the listing scan's compute circuit is open, because more reads would only extend the outage.
 */
export function useHomeSummaryRetry(options: {
	failedAssetIds: string[];
	failedCollectionIds: string[];
	listingFailure: HomeListingFailure | undefined;
}): HomeSummaryRetry {
	const [attempt, setAttempt] = React.useState(0);
	const [retrying, setRetrying] = React.useState(false);
	const runRef = React.useRef<HomeSummaryRetryRun>({ token: 0, pending: new Set() });
	const keysRef = React.useRef<Record<HomeSummaryRetryGroup, Set<string>>>({
		assets: new Set(),
		collections: new Set(),
	});
	const failedRef = React.useRef({ assets: options.failedAssetIds, collections: options.failedCollectionIds });
	failedRef.current = { assets: options.failedAssetIds, collections: options.failedCollectionIds };
	const failureKey = `${options.failedAssetIds.join(',')}|${options.failedCollectionIds.join(',')}`;

	const claim = React.useCallback((group: HomeSummaryRetryGroup) => {
		const keys = new Set(keysRef.current[group]);
		keysRef.current[group].clear();
		return { keys, token: runRef.current.pending.has(group) ? runRef.current.token : null };
	}, []);

	const finish = React.useCallback((token: number, group: HomeSummaryRetryGroup, activeRequests: number) => {
		if (completeHomeSummaryRetryGroup(runRef.current, token, group, activeRequests)) setRetrying(false);
	}, []);

	React.useEffect(() => {
		if (!failureKey || failureKey === '|' || retrying || options.listingFailure?.source === 'compute') return;
		const timer = window.setTimeout(() => {
			const failed = failedRef.current;
			keysRef.current = { assets: new Set(failed.assets), collections: new Set(failed.collections) };
			const run = startHomeSummaryRetry(runRef.current, failed.assets, failed.collections);
			if (!run) return;
			runRef.current = run;
			setRetrying(true);
			setAttempt((current) => current + 1);
		}, HOME_SUMMARY_RETRY_DELAY_MS);
		return () => window.clearTimeout(timer);
	}, [failureKey, options.listingFailure, retrying]);

	return {
		attempt,
		assetsRetrying: retrying && runRef.current.pending.has('assets'),
		collectionsRetrying: retrying && runRef.current.pending.has('collections'),
		claim,
		finish,
	};
}
