import React from 'react';

import {
	type Collection,
	type HomeListingShell,
	loadHomeListingSnapshot,
	storeHomeListingSnapshot,
} from 'api/collections';
import {
	type AssetCandidate,
	createAssetCandidateResolver,
	discoverMarketActivity,
	partitionAssetCandidateSupport,
	verifyAssetCandidateSupport,
} from 'api/discovery';
import { readAssetStateCached } from 'api/marketplace';

import { createAnimationFrameBatch } from 'helpers/animation-frame-batch';
import { requestFailureKind } from 'helpers/app-error';
import { scheduleIdleTask } from 'helpers/idle';

import {
	type HomeListingFailure,
	type HomeListingPublication,
	type HomeListingScanEvent,
	homeListingScanReducer,
	type HomeListingScanState,
	initialHomeListingScan,
} from '../model/home-listing-scan';
import {
	HOME_ASSET_PAGE_SIZE,
	HOME_LISTING_SNAPSHOT_MAX_AGE_MS,
	HOME_STATE_MAX_AGE,
	HOME_STATE_STALE_WHILE_REVALIDATE,
	type HomeListingComputeCircuit,
	homeListingComputeFailure,
	homeListingSupportVersion,
	recordHomeListingComputeResult,
} from '../model/home-market';

function restoreHomeListingScan(snapshotScope: string) {
	return initialHomeListingScan(
		loadHomeListingSnapshot(window.sessionStorage, snapshotScope, HOME_LISTING_SNAPSHOT_MAX_AGE_MS)
	);
}

// The listing scan's state, seeded from this session's snapshot so Discover can paint listings before any request.
export function useHomeListingScanStore(
	snapshotScope: string
): [HomeListingScanState, React.Dispatch<HomeListingScanEvent>] {
	return React.useReducer(homeListingScanReducer, snapshotScope, restoreHomeListingScan);
}

/**
 * Scans the marketplace-wide listing index for Discover and resolves every candidate's live state.
 *
 * Index pages stream candidates into a resolver (eight concurrent AO reads, stale-while-revalidate); candidates from
 * unrecognized collections are verified first. Results publish once per animation frame. A new scope, collection set,
 * or retry cancels the previous scan. After `HOME_LISTING_ASSET_LIMIT` consecutive compute failures in one scope the
 * circuit opens: the scan stops and later scans in that scope fail immediately until the user retries. Completed or
 * large live results are saved to session storage during idle time.
 */
export function useHomeListingScan(options: {
	dispatch: React.Dispatch<HomeListingScanEvent>;
	liveShells: HomeListingShell[];
	complete: boolean;
	active: boolean;
	aoRoutingScope: string;
	collections: Collection[];
	snapshotScope: string;
	visibilityReady: boolean;
}): { retry(): void } {
	const dispatch = options.dispatch;
	const [retryAttempt, setRetryAttempt] = React.useState(0);
	const runRef = React.useRef(0);
	const computeCircuitRef = React.useRef<HomeListingComputeCircuit>({ scope: '', consecutiveFailures: 0 });
	const collectionsRef = React.useRef(options.collections);
	collectionsRef.current = options.collections;
	const listingSupportVersion = React.useMemo(
		() => homeListingSupportVersion(options.collections),
		[options.collections]
	);
	const retry = React.useCallback(() => setRetryAttempt((attempt) => attempt + 1), []);

	// Hidden-collection visibility can change which snapshot listings are safe to show, so reload it then too.
	React.useEffect(() => {
		dispatch({
			type: 'snapshot-restored',
			cached: loadHomeListingSnapshot(
				window.sessionStorage,
				options.snapshotScope,
				HOME_LISTING_SNAPSHOT_MAX_AGE_MS
			),
		});
	}, [dispatch, options.snapshotScope, options.visibilityReady]);

	React.useEffect(() => {
		if (!options.active) {
			dispatch({ type: 'stopped' });
			return;
		}
		const computeCircuitScope = `${options.aoRoutingScope}|${retryAttempt}`;
		const computeCircuit = computeCircuitRef.current;
		recordHomeListingComputeResult(computeCircuit, computeCircuitScope);
		if (computeCircuit.failure !== undefined) {
			dispatch({
				type: 'blocked',
				failure: { status: 'unavailable', source: 'compute', kind: requestFailureKind(computeCircuit.failure) },
			});
			return;
		}
		const run = runRef.current + 1;
		runRef.current = run;
		const controller = new AbortController();
		let disposed = false;
		dispatch({ type: 'started', run });
		const publications = createAnimationFrameBatch<HomeListingPublication>((batch) =>
			dispatch({ type: 'published', run, batch })
		);
		void (async () => {
			let indexFailure: unknown;
			let computeFailure: unknown;
			let computeAttempts = 0;
			let computeFailures = 0;
			let computeCircuitFailure: unknown;
			let discoveryFailure: unknown;
			const collections = collectionsRef.current;
			const resolver = createAssetCandidateResolver(collections, {
				signal: controller.signal,
				concurrency: 8,
				read: (processId, signal) =>
					readAssetStateCached(processId, {
						signal,
						maxAge: HOME_STATE_MAX_AGE,
						maxAttempts: 1,
						staleWhileRevalidate: HOME_STATE_STALE_WHILE_REVALIDATE,
						onRevalidated: (fresh) => {
							if (controller.signal.aborted) return;
							publications.push({
								processId,
								state: fresh.state,
								provider: fresh.provider,
								refresh: true,
							});
						},
					}),
				onSettled: (result, candidate, cause) => {
					if (controller.signal.aborted) return;
					computeAttempts += 1;
					if (cause) {
						computeFailures += 1;
						computeFailure ??= cause;
						computeCircuitFailure ??= recordHomeListingComputeResult(
							computeCircuit,
							computeCircuitScope,
							cause
						);
						if (computeCircuitFailure !== undefined) controller.abort(computeCircuitFailure);
						return;
					}
					recordHomeListingComputeResult(computeCircuit, computeCircuitScope);
					publications.push({ processId: candidate.processId, result });
				},
			});
			let supportTail = Promise.resolve();
			const publishCandidates = (candidates: AssetCandidate[]) => {
				const { supported, unverified } = partitionAssetCandidateSupport(candidates, collections);
				resolver.enqueue(supported);
				if (unverified.length) {
					supportTail = supportTail.then(async () => {
						try {
							const verification = await verifyAssetCandidateSupport(unverified, collections, {
								signal: controller.signal,
								onVerified: (verified) => resolver.enqueue(verified),
							});
							indexFailure ??= verification.unavailable[0]?.error;
						} catch (cause) {
							if (controller.signal.aborted) throw cause;
							indexFailure ??= cause;
						}
					});
				}
			};
			try {
				await discoverMarketActivity({
					listingsOnly: true,
					signal: controller.signal,
					onPage: publishCandidates,
				});
			} catch (cause) {
				if (computeCircuitFailure === undefined) discoveryFailure = cause;
			}
			let failure: HomeListingFailure | undefined;
			try {
				await supportTail;
				await resolver.finish();
				controller.signal.throwIfAborted();
				const cause =
					discoveryFailure ??
					indexFailure ??
					homeListingComputeFailure(computeFailure, computeAttempts, computeFailures);
				failure = cause
					? {
							status: 'unavailable',
							source: discoveryFailure || indexFailure ? 'index' : 'compute',
							kind: requestFailureKind(cause),
					  }
					: undefined;
			} catch (cause) {
				failure = {
					status: 'unavailable',
					source:
						computeCircuitFailure === undefined && (discoveryFailure || indexFailure) ? 'index' : 'compute',
					kind: requestFailureKind(computeCircuitFailure ?? cause),
				};
			} finally {
				if (!disposed) {
					publications.flush();
					dispatch({ type: 'finished', run, failure });
				}
			}
		})();
		return () => {
			disposed = true;
			controller.abort();
			publications.cancel();
		};
	}, [dispatch, listingSupportVersion, options.active, options.aoRoutingScope, retryAttempt]);

	React.useEffect(() => {
		const liveShells = options.liveShells;
		if (!liveShells.length || (!options.complete && liveShells.length < HOME_ASSET_PAGE_SIZE)) return;
		return scheduleIdleTask(
			() => storeHomeListingSnapshot(window.sessionStorage, options.snapshotScope, liveShells),
			250
		);
	}, [options.complete, options.liveShells, options.snapshotScope]);

	return { retry };
}
