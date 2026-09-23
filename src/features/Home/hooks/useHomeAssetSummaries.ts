import React from 'react';

import type { ResolvedAsset } from 'api/discovery';
import { type AssetState, readAssetStateCached } from 'api/marketplace';

import { requestFailureKind } from 'helpers/app-error';
import { createKeyedTaskQueue } from 'helpers/keyed-task-queue';

import {
	HOME_STATE_MAX_AGE,
	HOME_STATE_STALE_WHILE_REVALIDATE,
	type HomeMarketSummary,
	homeSummaryRequestKeys,
} from '../model/home-market';
import { homeAssetStateSummary, type HomeMarketSummaryEvent } from '../model/home-market-summaries';
import type { HomeMarketEntry } from '../model/home-market-view';

import type { HomeSummaryRetry } from './useHomeSummaryRetry';

const SUMMARY_CONCURRENCY = 8;

/**
 * Loads live price summaries for the assets Discover currently shows, eight AO reads at a time.
 *
 * One shared queue spans incremental catalogue updates, so a growing asset list cannot enqueue and abort the same
 * unfinished reads again; `priorityKey` promotes what the visitor is looking at without restarting queued work. Each
 * asset keeps at most one request: leaving the visible set aborts it and cancels its queued task, and its summary is
 * dropped. A live listing from the scan supplies state without another read; otherwise cached state renders first and
 * a background revalidation republishes the price. Order state is read without the slow holder table.
 */
export function useHomeAssetSummaries(options: {
	active: boolean;
	assets: HomeMarketEntry[];
	assetKey: string;
	/** The visible asset IDs in read order, most important first. */
	priorityKey: string;
	assetPrices: Record<string, HomeMarketSummary>;
	listingById: ReadonlyMap<string, ResolvedAsset>;
	listingStateKey: string;
	dispatch: React.Dispatch<HomeMarketSummaryEvent>;
	retry: Pick<HomeSummaryRetry, 'attempt' | 'claim' | 'finish'>;
}): void {
	const dispatch = options.dispatch;
	const claimRetry = options.retry.claim;
	const finishRetry = options.retry.finish;
	const controllersRef = React.useRef(new Map<string, AbortController>());
	const [queue] = React.useState(() => createKeyedTaskQueue(SUMMARY_CONCURRENCY));
	// The request set is keyed by `assetKey` and `listingStateKey`; these carry the matching values into the effect.
	const inputsRef = React.useRef(options);
	inputsRef.current = options;

	React.useEffect(() => {
		const controllers = controllersRef.current;
		return () => {
			for (const controller of controllers.values()) controller.abort();
			queue.clear();
			controllers.clear();
		};
	}, [queue]);

	React.useEffect(() => {
		const controllers = controllersRef.current;
		if (!options.active) {
			for (const controller of controllers.values()) controller.abort();
			queue.clear();
			controllers.clear();
			return;
		}
		const inputs = inputsRef.current;
		const visibleAssetIds = new Set(inputs.assets.map(({ asset }) => asset.id));
		for (const [assetId, controller] of controllers) {
			if (visibleAssetIds.has(assetId)) continue;
			controller.abort();
			queue.cancel(assetId);
			controllers.delete(assetId);
		}
		dispatch({ type: 'assets-retained', assetIds: visibleAssetIds });
		const claimed = claimRetry('assets');
		const requestedAssetIds = new Set(
			homeSummaryRequestKeys(
				inputs.assets.map(({ asset }) => asset.id),
				inputs.assetPrices,
				controllers.keys(),
				claimed.keys
			)
		);
		const priorityIds = options.priorityKey.split(',');
		const priority = new Map(priorityIds.map((assetId, index) => [assetId, index]));
		const requestedAssets = inputs.assets
			.filter(({ asset }) => requestedAssetIds.has(asset.id))
			.sort(
				(left, right) =>
					(priority.get(left.asset.id) ?? Number.POSITIVE_INFINITY) -
					(priority.get(right.asset.id) ?? Number.POSITIVE_INFINITY)
			);
		// Reserve every queued ID before starting work so incremental catalogue
		// updates cannot enqueue and abort the same unfinished reads again.
		const scheduled = requestedAssets.map(({ asset, collection }) => {
			controllers.get(asset.id)?.abort();
			queue.cancel(asset.id);
			const controller = new AbortController();
			controllers.set(asset.id, controller);
			return { asset, collection, controller };
		});
		queue.prioritize(priorityIds);
		let retryFinished = false;
		const finishClaimedRetry = () => {
			if (claimed.token === null || retryFinished) return;
			retryFinished = true;
			finishRetry(claimed.token, 'assets', controllers.size);
		};
		void Promise.all(
			scheduled.map(({ asset, collection, controller }) =>
				queue.enqueue(asset.id, async () => {
					if (controller.signal.aborted) return;
					let trackingRevalidation = false;
					try {
						const publishPrice = (state: AssetState) => {
							if (controller.signal.aborted) return;
							const summary = homeAssetStateSummary(collection, asset.id, state);
							dispatch({
								type: 'asset-price-resolved',
								assetId: asset.id,
								price: summary.price,
								image: summary.image,
							});
						};
						let state = inputs.listingById.get(asset.id)?.state;
						if (!state) {
							const computed = await readAssetStateCached(asset.id, {
								signal: controller.signal,
								maxAge: HOME_STATE_MAX_AGE,
								includeBalances: false,
								maxAttempts: 1,
								staleWhileRevalidate: HOME_STATE_STALE_WHILE_REVALIDATE,
								onRevalidated: (fresh) => publishPrice(fresh.state),
							});
							state = computed.state;
							if (computed.revalidation) {
								trackingRevalidation = true;
								const finishRevalidation = () => {
									if (controllers.get(asset.id) === controller) controllers.delete(asset.id);
								};
								void computed.revalidation.then(finishRevalidation, finishRevalidation);
							}
						}
						publishPrice(state);
					} catch (cause) {
						if (!controller.signal.aborted) {
							dispatch({
								type: 'asset-price-failed',
								assetId: asset.id,
								kind: requestFailureKind(cause),
							});
						}
					} finally {
						if (!trackingRevalidation && controllers.get(asset.id) === controller) {
							controllers.delete(asset.id);
						}
					}
				})
			)
		).then(finishClaimedRetry);
		queue.prioritize(priorityIds);
	}, [
		claimRetry,
		dispatch,
		finishRetry,
		options.active,
		options.assetKey,
		options.listingStateKey,
		options.priorityKey,
		options.retry.attempt,
		queue,
	]);
}
