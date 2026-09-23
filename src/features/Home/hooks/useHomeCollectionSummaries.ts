import React from 'react';

import { type Collection, collectionAsset } from 'api/collections';
import {
	type AssetCandidate,
	createAssetCandidateResolver,
	discoverMarketActivity,
	discoverMarketActivityBatched,
} from 'api/discovery';
import { bestAskOfAsset, readAssetStateCached } from 'api/marketplace';

import { collectionCandidateMembership } from 'features/Activity';
import { orderPriceLabel, unitPriceWinston } from 'features/Catalogue';
import { type RequestFailureKind, requestFailureKind } from 'helpers/app-error';

import {
	commitHomeActivityBatch,
	commitHomeFloorResult,
	completeHomeActivityScan,
	HOME_STATE_MAX_AGE,
	HOME_STATE_STALE_WHILE_REVALIDATE,
	type HomeActivityScan,
	homeFloorCandidateNeedsResolution,
	type HomeFloorScan,
	homeFloorScanSummary,
	type HomeListingActivity,
	type HomeMarketSummary,
	pendingHomeActivityRecipients,
	reconcileHomeActivityScan,
	reconcileHomeFloorScan,
} from '../model/home-market';
import type { HomeMarketSummaryEvent } from '../model/home-market-summaries';
import { homeCollectionSummaryVersion } from '../model/home-market-view';

import type { HomeSummaryRetry } from './useHomeSummaryRetry';

type FloorOutcome = { candidate: AssetCandidate; asking: bigint | null; failure?: RequestFailureKind };

/**
 * Computes each visible collection's live floor and verifies its listings for Collections.
 *
 * Every collection scans its listing activity (names through the market index; others in recipient batches that
 * resume where an interrupted scan stopped), then resolves each candidate's live state four at a time. Floor and
 * activity scans survive across renders so unchanged candidates are not re-resolved. A collection whose asset window
 * or AO routing scope changes aborts its request and discards its floor; every result is checked against the request
 * that produced it before it publishes.
 */
export function useHomeCollectionSummaries(options: {
	active: boolean;
	collections: Collection[];
	collectionKey: string;
	aoRoutingScope: string;
	collectionFloors: Record<string, HomeMarketSummary>;
	dispatch: React.Dispatch<HomeMarketSummaryEvent>;
	retry: Pick<HomeSummaryRetry, 'attempt' | 'claim' | 'finish'>;
}): void {
	const dispatch = options.dispatch;
	const claimRetry = options.retry.claim;
	const finishRetry = options.retry.finish;
	const controllersRef = React.useRef(new Map<string, { version: string; controller: AbortController }>());
	const versionsRef = React.useRef(new Map<string, string>());
	const activityScansRef = React.useRef(new Map<string, HomeActivityScan>());
	const floorScansRef = React.useRef(new Map<string, HomeFloorScan>());
	// The request set is keyed by `collectionKey`; this carries the matching collections and floors into the effect.
	const inputsRef = React.useRef(options);
	inputsRef.current = options;

	React.useEffect(() => {
		const controllers = controllersRef.current;
		return () => {
			for (const { controller } of controllers.values()) controller.abort();
			controllers.clear();
		};
	}, []);

	React.useEffect(() => {
		const controllers = controllersRef.current;
		const versions = versionsRef.current;
		const activityScans = activityScansRef.current;
		const floorScans = floorScansRef.current;
		if (!options.active) {
			for (const { controller } of controllers.values()) controller.abort();
			controllers.clear();
			return;
		}
		const inputs = inputsRef.current;
		const visibleCollections = new Map(
			inputs.collections.map((collection) => [
				collection.id,
				homeCollectionSummaryVersion(collection, options.aoRoutingScope),
			])
		);
		const changedCollections = new Set<string>();
		for (const [collectionId, request] of controllers) {
			if (visibleCollections.get(collectionId) === request.version) continue;
			request.controller.abort();
			controllers.delete(collectionId);
		}
		for (const [collectionId, version] of versions) {
			if (visibleCollections.get(collectionId) === version) continue;
			changedCollections.add(collectionId);
			versions.delete(collectionId);
		}
		for (const collectionId of activityScans.keys()) {
			if (!visibleCollections.has(collectionId)) activityScans.delete(collectionId);
		}
		for (const collectionId of floorScans.keys()) {
			if (!visibleCollections.has(collectionId)) floorScans.delete(collectionId);
		}
		dispatch({
			type: 'collections-retained',
			collectionIds: new Set(visibleCollections.keys()),
			changedCollectionIds: changedCollections,
		});
		const claimed = claimRetry('collections');
		const requested = inputs.collections.flatMap((collection) => {
			const version = visibleCollections.get(collection.id);
			if (
				version === undefined ||
				!(
					claimed.keys.has(collection.id) ||
					versions.get(collection.id) !== version ||
					(!inputs.collectionFloors[collection.id] && !controllers.has(collection.id))
				)
			)
				return [];
			return [{ collection, version }];
		});
		let retryFinished = false;
		const finishClaimedRetry = () => {
			if (claimed.token === null || retryFinished) return;
			retryFinished = true;
			finishRetry(claimed.token, 'collections', controllers.size);
		};
		const requests = requested.map(({ collection, version }) =>
			(async () => {
				const previous = controllers.get(collection.id);
				if (previous) previous.controller.abort();
				const controller = new AbortController();
				controllers.set(collection.id, { version, controller });
				versions.set(collection.id, version);
				const isCurrent = () =>
					!controller.signal.aborted &&
					controllers.get(collection.id)?.controller === controller &&
					controllers.get(collection.id)?.version === version;
				try {
					const previousFloorScan = floorScans.get(collection.id);
					const scheduled = new Set<string>();
					const outcomes = new Map<string, FloorOutcome>();
					let floorScan: HomeFloorScan | undefined;
					const commitOutcome = (scan: HomeFloorScan, outcome: FloorOutcome) => {
						if (
							scan.candidates.get(outcome.candidate.processId) ===
							`${outcome.candidate.height}:${outcome.candidate.timestamp}`
						) {
							commitHomeFloorResult(scan, outcome.candidate.processId, outcome.asking, outcome.failure);
						}
					};
					const resolver = createAssetCandidateResolver([collection], {
						concurrency: 4,
						signal: controller.signal,
						read: (processId, signal) =>
							readAssetStateCached(processId, {
								signal,
								maxAge: HOME_STATE_MAX_AGE,
								maxAttempts: 1,
								staleWhileRevalidate: HOME_STATE_STALE_WHILE_REVALIDATE,
							}),
						onSettled: (result, candidate, cause) => {
							if (!isCurrent()) return;
							const order = !cause && result ? bestAskOfAsset(result.state) : null;
							const outcome: FloorOutcome = {
								candidate,
								asking: order && result ? unitPriceWinston(order, result.state.denomination) : null,
								...(cause ? { failure: requestFailureKind(cause) } : {}),
							};
							if (floorScan) commitOutcome(floorScan, outcome);
							else outcomes.set(candidate.processId, outcome);
							if (cause) return;
							const asset = result?.asset ?? collectionAsset(collection, candidate.processId);
							if (!asset) return;
							dispatch({
								type: 'listing-resolved',
								collectionId: collection.id,
								asset,
								listing:
									order && result
										? { price: orderPriceLabel(order, result.state), activity: candidate }
										: null,
							});
						},
					});
					const enqueueCandidates = (candidates: AssetCandidate[]) => {
						resolver.enqueue(
							candidates.filter((candidate) => {
								if (
									scheduled.has(candidate.processId) ||
									!homeFloorCandidateNeedsResolution(previousFloorScan, version, candidate)
								)
									return false;
								scheduled.add(candidate.processId);
								return true;
							})
						);
					};
					let candidates: AssetCandidate[];
					if (collection.kind === 'names') {
						candidates = await discoverMarketActivity({
							listingsOnly: true,
							signal: controller.signal,
							acceptProcessId: collectionCandidateMembership(collection),
							onPage: enqueueCandidates,
						});
					} else {
						const recipients = [...new Set(collection.assets.map((asset) => asset.id))];
						const scan = reconcileHomeActivityScan(activityScans.get(collection.id), recipients);
						activityScans.set(collection.id, scan);
						const pending = pendingHomeActivityRecipients(scan, recipients);
						if (pending.length) {
							await discoverMarketActivityBatched({
								listingsOnly: true,
								recipients: pending,
								signal: controller.signal,
								onBatch: (batchCandidates, batchRecipients) => {
									if (!isCurrent() || activityScans.get(collection.id) !== scan) return;
									commitHomeActivityBatch(scan, batchCandidates, batchRecipients);
									enqueueCandidates(batchCandidates);
								},
							});
						}
						controller.signal.throwIfAborted();
						if (
							activityScans.get(collection.id) !== scan ||
							recipients.some((recipient) => !scan.completed.has(recipient))
						) {
							controller.abort(new DOMException('Home activity scan replaced.', 'AbortError'));
							controller.signal.throwIfAborted();
						}
						completeHomeActivityScan(scan, recipients);
						candidates = [...scan.candidates.values()];
					}
					enqueueCandidates(candidates);
					const reconciledScan = reconcileHomeFloorScan(previousFloorScan, version, candidates);
					floorScan = reconciledScan;
					floorScans.set(collection.id, reconciledScan);
					for (const outcome of outcomes.values()) commitOutcome(reconciledScan, outcome);
					await resolver.finish();
					controller.signal.throwIfAborted();
					if (floorScans.get(collection.id) !== reconciledScan) {
						controller.abort(new DOMException('Home floor scan replaced.', 'AbortError'));
						controller.signal.throwIfAborted();
					}
					if (!controller.signal.aborted) {
						const listingIds = [...reconciledScan.settled].flatMap(([processId, asking]) =>
							asking === null ? [] : [processId]
						);
						const activityScan = activityScans.get(collection.id);
						const activity: Record<string, HomeListingActivity> = {};
						for (const assetId of listingIds) {
							const candidate = activityScan?.candidates.get(assetId);
							if (candidate) activity[assetId] = candidate;
						}
						dispatch({
							type: 'collection-floor-resolved',
							collection,
							listingIds,
							activity,
							floor: homeFloorScanSummary(reconciledScan),
						});
					}
				} catch (cause) {
					if (!controller.signal.aborted) {
						dispatch({
							type: 'collection-floor-failed',
							collectionId: collection.id,
							kind: requestFailureKind(cause),
						});
						controller.abort(cause);
					}
				} finally {
					if (controllers.get(collection.id)?.controller === controller) controllers.delete(collection.id);
				}
			})()
		);
		void Promise.all(requests).then(finishClaimedRetry);
	}, [
		claimRetry,
		dispatch,
		finishRetry,
		options.active,
		options.aoRoutingScope,
		options.collectionKey,
		options.retry.attempt,
	]);
}
