import React from 'react';

import {
	type AssetCandidate,
	createAssetCandidateResolver,
	createWalletCandidateScan,
	discoverWalletAssetCandidates,
	loadCompletedWalletCandidateScan,
	partitionAssetCandidateSupport,
	resolveAssetCandidates,
	type ResolvedAsset,
	resumeCompletedWalletCandidateScan,
	storeCompletedWalletCandidateScan,
	verifyAssetCandidateSupport,
} from 'api/discovery';
import { DISPLAY_STATE_CACHE, readAssetStateCached, servingNodeOrigin } from 'api/marketplace';

import { requestFailureKind, toAppError } from 'helpers/app-error';
import { scheduleIdleTask } from 'helpers/idle';
import { useMarketProvider } from 'providers/MarketProvider';

import { sortWalletResults } from '../model/wallet-assets';
import {
	candidateCheckOutcome,
	type CandidateSupportFailure,
	initialWalletResolutionStatus,
	nextWalletAnnouncementProgress,
	refreshCandidateRetryMetadata,
	reopenWalletCandidate,
	trackRateLimitFailure,
	updateWalletResolvedAsset,
	type WalletAnnouncementProgress,
	walletDiscoveryError,
	walletDiscoveryScope,
	type WalletDiscoverySession,
	walletDiscoverySession,
	walletDiscoverySessionIsCurrent,
	walletResolutionCopy,
	walletResolutionFailureMessage,
	walletResolutionReducer,
	type WalletResolutionStatus,
} from '../model/wallet-resolution';

export type WalletAssetDiscovery = {
	/** The serving node the inventory is read through. */
	gateway: string;
	/** Resolved assets the wallet owns or has listed, newest activity first. */
	results: ResolvedAsset[];
	status: WalletResolutionStatus;
	/** Progress heading and live-region announcement, throttled to bounded milestones. */
	/** Which service left candidates unavailable: the transaction index, AO compute, or both. */
	failureMessage: string;
	resolutionCopy: { heading: string; announcement: string };
	/** Restart discovery from nothing, bypassing cached asset state. */
	refresh(): void;
	/** Resume an interrupted discovery pass. */
	retryDiscovery(): void;
	/** Recheck only the candidates whose index or compute checks failed. */
	retryUnavailable(): void;
};

/**
 * Discovers a wallet's asset candidates from the transaction index and resolves each against live AO state.
 *
 * A session is scoped to the wallet, serving node, supported collections, and refresh count. Remounts and retries
 * within the same scope resume its progress; completed scans persist to local storage for the next visit. Results
 * render progressively (one frame per batch) and cached states are revalidated at zero age before completion.
 */
export function useWalletAssetDiscovery(address: string): WalletAssetDiscovery {
	const market = useMarketProvider();
	const gateway = servingNodeOrigin(window.location);
	const [retry, setRetry] = React.useState(0);
	const [discoveryRetry, setDiscoveryRetry] = React.useState(0);
	const [failedRetry, setFailedRetry] = React.useState(0);
	const failedCandidates = React.useRef(new Map<string, AssetCandidate>());
	const supportFailures = React.useRef(new Map<string, CandidateSupportFailure>());
	const computeRateLimits = React.useRef(new Set<string>());
	const indexRateLimits = React.useRef(new Set<string>());
	const discoverySession = React.useRef<WalletDiscoverySession>();
	const walletAnnouncementProgress = React.useRef<WalletAnnouncementProgress>({
		scope: '',
		discovered: 0,
		revalidated: 0,
	});
	const [results, setResults] = React.useState<ResolvedAsset[]>([]);
	const [storedStatus, dispatch] = React.useReducer(
		walletResolutionReducer,
		undefined,
		initialWalletResolutionStatus
	);
	const discoveryScope = address ? walletDiscoveryScope(address, gateway, market.collections) : '';
	const requestedSessionScope = discoveryScope ? `${discoveryScope}|refresh:${retry}` : '';
	const sessionIsCurrent = walletDiscoverySessionIsCurrent(discoverySession.current, requestedSessionScope);
	const visibleResults = sessionIsCurrent ? results : [];
	const status = sessionIsCurrent ? storedStatus : initialWalletResolutionStatus();
	const refresh = React.useCallback(() => setRetry((value) => value + 1), []);
	const retryDiscovery = React.useCallback(() => setDiscoveryRetry((value) => value + 1), []);
	const retryUnavailable = React.useCallback(() => setFailedRetry((value) => value + 1), []);

	// Keyed by the discovery scope rather than the collections array: a new array with the same supported
	// collections resumes the running session instead of restarting it.
	React.useEffect(() => {
		if (!address || !market.collections.length || market.error) return;
		const controller = new AbortController();
		const scope = requestedSessionScope;
		const previousSession = discoverySession.current;
		const scan =
			(previousSession?.scope === scope ? previousSession.scan : undefined) ??
			resumeCompletedWalletCandidateScan(previousSession?.scan, address) ??
			loadCompletedWalletCandidateScan(window.localStorage, address) ??
			createWalletCandidateScan(address);
		const session = walletDiscoverySession(previousSession, scope, address, scan);
		const reset = session !== previousSession;
		discoverySession.current = session;
		const active = () => !controller.signal.aborted && discoverySession.current === session;
		const revalidations: Promise<unknown>[] = [];
		let renderFrame: number | undefined;
		let cancelScanStore: (() => void) | undefined;
		const flushResults = () => {
			renderFrame = undefined;
			if (!active()) return;
			setResults(sortWalletResults(session.resolvedAssets.values()));
		};
		const scheduleResults = () => {
			if (renderFrame === undefined) renderFrame = window.requestAnimationFrame(flushResults);
		};
		if (reset) {
			failedCandidates.current.clear();
			supportFailures.current.clear();
			computeRateLimits.current.clear();
			indexRateLimits.current.clear();
			setResults([]);
			dispatch({ type: 'reset' });
		} else {
			dispatch({ type: 'resumed' });
			scheduleResults();
		}
		void (async () => {
			try {
				const scheduled = new Set<string>();
				const readWalletState = async (processId: string, signal?: AbortSignal) => {
					const result = await readAssetStateCached(processId, {
						force: true,
						maxAge: 0,
						maxAttempts: 1,
						signal,
						...(retry === 0 ? { staleWhileRevalidate: DISPLAY_STATE_CACHE.staleWhileRevalidate } : {}),
					});
					if (result.revalidation) {
						revalidations.push(result.revalidation);
						if (active()) dispatch({ type: 'revalidation-scheduled' });
					}
					return result;
				};
				const resolver = createAssetCandidateResolver(market.collections, {
					signal: controller.signal,
					// A wallet inventory is ownership: an unreadable holder table is a failure, not an empty holding.
					requireHolderBalances: true,
					read: readWalletState,
					onSettled: (result, candidate, error) => {
						if (!active()) return;
						const latest = session.latestCandidates.get(candidate.processId) ?? candidate;
						session.screened.add(candidate.processId);
						session.completed.add(candidate.processId);
						if (error) failedCandidates.current.set(candidate.processId, latest);
						else failedCandidates.current.delete(candidate.processId);
						trackRateLimitFailure(computeRateLimits.current, candidate.processId, error);
						dispatch({ type: 'candidate-settled', outcome: candidateCheckOutcome(error) });
						if (!error && updateWalletResolvedAsset(session, result, latest, address)) scheduleResults();
					},
					onRevalidated: (result, candidate, error) => {
						if (!active()) return;
						const latest = session.latestCandidates.get(candidate.processId) ?? candidate;
						if (error) failedCandidates.current.set(candidate.processId, latest);
						else failedCandidates.current.delete(candidate.processId);
						trackRateLimitFailure(computeRateLimits.current, candidate.processId, error);
						if (error) {
							if (session.resolvedAssets.delete(candidate.processId)) scheduleResults();
						} else if (updateWalletResolvedAsset(session, result, latest, address)) {
							scheduleResults();
						}
						dispatch({ type: 'candidate-revalidated', outcome: candidateCheckOutcome(error) });
					},
				});
				let supportTail = Promise.resolve();
				const resolvePage = (page: AssetCandidate[]) => {
					let reopened = 0;
					let reopenedFailures = 0;
					let reopenedIndexFailures = 0;
					let reopenedRateLimits = 0;
					let reopenedIndexRateLimits = 0;
					for (const candidate of page) {
						const wasComputeFailure = failedCandidates.current.has(candidate.processId);
						const wasIndexFailure = supportFailures.current.has(candidate.processId);
						const wasComputeRateLimited = computeRateLimits.current.has(candidate.processId);
						const wasIndexRateLimited = indexRateLimits.current.has(candidate.processId);
						const refreshed = reopenWalletCandidate(session, candidate);
						if (refreshed.completed) {
							reopened += 1;
							reopenedFailures += Number(wasComputeFailure || wasIndexFailure);
							reopenedIndexFailures += Number(wasIndexFailure);
							reopenedRateLimits += Number(wasComputeRateLimited || wasIndexRateLimited);
							reopenedIndexRateLimits += Number(wasIndexRateLimited);
						}
						if (refreshed.reopened) {
							failedCandidates.current.delete(candidate.processId);
							supportFailures.current.delete(candidate.processId);
							computeRateLimits.current.delete(candidate.processId);
							indexRateLimits.current.delete(candidate.processId);
							if (refreshed.removedResult) scheduleResults();
						}
						session.latestCandidates.set(candidate.processId, candidate);
						refreshCandidateRetryMetadata(candidate, failedCandidates.current, supportFailures.current);
						const existing = session.resolvedAssets.get(candidate.processId);
						if (existing) {
							session.resolvedAssets.set(candidate.processId, { ...existing, activity: candidate });
							scheduleResults();
						}
					}
					if (reopened && active()) {
						dispatch({
							type: 'candidates-reopened',
							reopened,
							failures: reopenedFailures,
							indexFailures: reopenedIndexFailures,
							rateLimited: reopenedRateLimits,
							indexRateLimited: reopenedIndexRateLimits,
						});
					}
					const unchecked = page.filter(
						(candidate) => !session.screened.has(candidate.processId) && !scheduled.has(candidate.processId)
					);
					const { supported, unverified } = partitionAssetCandidateSupport(unchecked, market.collections);
					const candidates = [...supported, ...unverified];
					for (const candidate of candidates) scheduled.add(candidate.processId);
					const candidateIds = new Set(candidates.map((candidate) => candidate.processId));
					for (const candidate of unchecked) {
						if (!candidateIds.has(candidate.processId)) session.screened.add(candidate.processId);
					}
					const newlyCounted = candidates.filter((candidate) => !session.counted.has(candidate.processId));
					for (const candidate of newlyCounted) session.counted.add(candidate.processId);
					if (active()) {
						dispatch({
							type: 'page-screened',
							discovered: session.latestCandidates.size,
							counted: newlyCounted.length,
							resolving: candidates.length > 0,
						});
					}
					resolver.enqueue(supported);
					if (unverified.length) {
						supportTail = supportTail.then(async () => {
							const verification = await verifyAssetCandidateSupport(unverified, market.collections, {
								signal: controller.signal,
								onVerified: (verified) => resolver.enqueue(verified),
							});
							if (!active()) return;
							for (const candidate of unverified) supportFailures.current.delete(candidate.processId);
							for (const failure of verification.unavailable) {
								supportFailures.current.set(failure.candidate.processId, failure);
								trackRateLimitFailure(
									indexRateLimits.current,
									failure.candidate.processId,
									failure.error
								);
							}
							for (const candidate of unverified) {
								if (!supportFailures.current.has(candidate.processId))
									indexRateLimits.current.delete(candidate.processId);
							}
							const verifiedIds = new Set(verification.supported.map((candidate) => candidate.processId));
							for (const candidate of unverified) {
								if (!verifiedIds.has(candidate.processId)) session.screened.add(candidate.processId);
							}
							const checkedWithoutCompute = unverified.length - verification.supported.length;
							const rateLimited = verification.unavailable.filter(
								(failure) => requestFailureKind(failure.error) === 'rate-limited'
							).length;
							if (checkedWithoutCompute && active()) {
								for (const candidate of unverified) {
									if (!verifiedIds.has(candidate.processId))
										session.completed.add(candidate.processId);
								}
								dispatch({
									type: 'support-checked',
									checked: checkedWithoutCompute,
									unavailable: verification.unavailable.length,
									rateLimited,
								});
							}
						});
					}
				};
				const pendingCandidates = [...session.latestCandidates.values()].filter(
					(candidate) => !session.screened.has(candidate.processId)
				);
				if (pendingCandidates.length) resolvePage(pendingCandidates);
				let discoveredCandidates: AssetCandidate[] = [];
				let discoveryFailure: unknown;
				try {
					discoveredCandidates = await discoverWalletAssetCandidates(address, {
						signal: controller.signal,
						scan: session.scan,
						catchUp: true,
						onPage: resolvePage,
					});
				} catch (cause) {
					discoveryFailure = cause;
				}
				if (!active()) return;
				if (!discoveryFailure) {
					cancelScanStore = scheduleIdleTask(
						() => storeCompletedWalletCandidateScan(window.localStorage, session.scan),
						500
					);
				}
				resolvePage(discoveredCandidates.filter((candidate) => !session.screened.has(candidate.processId)));
				let resolutionFailure: unknown;
				try {
					await supportTail;
				} catch (cause) {
					resolutionFailure = cause;
				}
				try {
					await resolver.finish();
				} catch (cause) {
					resolutionFailure ??= cause;
				}
				if (discoveryFailure || resolutionFailure) throw discoveryFailure ?? resolutionFailure;
				if (revalidations.length && active()) {
					dispatch({ type: 'revalidating' });
					await Promise.allSettled(revalidations);
				}
				if (active()) {
					session.complete = true;
					if (renderFrame !== undefined) window.cancelAnimationFrame(renderFrame);
					flushResults();
					dispatch({ type: 'completed', discovered: session.latestCandidates.size });
				}
			} catch (cause) {
				if (active()) dispatch({ type: 'failed', error: walletDiscoveryError(cause) });
			}
		})();
		return () => {
			controller.abort();
			cancelScanStore?.();
			if (renderFrame !== undefined) window.cancelAnimationFrame(renderFrame);
		};
	}, [address, discoveryRetry, discoveryScope, gateway, market.error, retry]);

	React.useEffect(() => {
		if (
			!failedRetry ||
			!address ||
			!market.collections.length ||
			market.error ||
			(!failedCandidates.current.size && !supportFailures.current.size)
		)
			return;
		const controller = new AbortController();
		const session = discoverySession.current;
		if (!walletDiscoverySessionIsCurrent(session, requestedSessionScope)) return;
		const active = () => !controller.signal.aborted && discoverySession.current === session;
		const candidates = [...failedCandidates.current.values()];
		const unverified = [...supportFailures.current.values()].map((failure) => failure.candidate);
		const retriedIndexRateLimited = unverified.filter((candidate) =>
			indexRateLimits.current.has(candidate.processId)
		).length;
		dispatch({
			type: 'retry-started',
			retried: candidates.length + unverified.length,
			retriedIndex: unverified.length,
			retriedRateLimited: candidates.filter((candidate) => computeRateLimits.current.has(candidate.processId))
				.length,
			retriedIndexRateLimited,
		});
		const resolveFailed = (failed: AssetCandidate[]) =>
			resolveAssetCandidates(failed, market.collections, {
				signal: controller.signal,
				requireHolderBalances: true,
				onSettled: (result, candidate, error) => {
					if (!active()) return;
					if (error) failedCandidates.current.set(candidate.processId, candidate);
					else failedCandidates.current.delete(candidate.processId);
					trackRateLimitFailure(computeRateLimits.current, candidate.processId, error);
					if (!error) updateWalletResolvedAsset(session, result, candidate, address);
					dispatch({ type: 'candidate-settled', outcome: candidateCheckOutcome(error) });
				},
			});
		const retryUnavailableCandidates = async () => {
			const verification = unverified.length
				? await verifyAssetCandidateSupport(unverified, market.collections, { signal: controller.signal })
				: { supported: [], unavailable: [] };
			if (!active()) return;
			for (const candidate of unverified) supportFailures.current.delete(candidate.processId);
			for (const failure of verification.unavailable) {
				supportFailures.current.set(failure.candidate.processId, failure);
				trackRateLimitFailure(indexRateLimits.current, failure.candidate.processId, failure.error);
			}
			for (const candidate of unverified) {
				if (!supportFailures.current.has(candidate.processId))
					indexRateLimits.current.delete(candidate.processId);
			}
			const checkedWithoutCompute = unverified.length - verification.supported.length;
			const rateLimited = verification.unavailable.filter(
				(failure) => requestFailureKind(failure.error) === 'rate-limited'
			).length;
			if (checkedWithoutCompute && active()) {
				dispatch({
					type: 'support-checked',
					checked: checkedWithoutCompute,
					unavailable: verification.unavailable.length,
					rateLimited,
				});
			}
			await resolveFailed([...candidates, ...verification.supported]);
		};
		void retryUnavailableCandidates().then(
			() => {
				if (!active()) return;
				setResults(sortWalletResults(session.resolvedAssets.values()));
				dispatch({
					type: 'retry-completed',
					failures: failedCandidates.current.size + supportFailures.current.size,
					indexFailures: supportFailures.current.size,
					rateLimited: computeRateLimits.current.size + indexRateLimits.current.size,
					indexRateLimited: indexRateLimits.current.size,
				});
			},
			(cause) => {
				if (active()) dispatch({ type: 'failed', error: toAppError(cause, 'unknown') });
			}
		);
		return () => controller.abort();
	}, [address, failedRetry, gateway, market.collections, market.error, requestedSessionScope]);

	walletAnnouncementProgress.current = nextWalletAnnouncementProgress(
		walletAnnouncementProgress.current,
		status,
		requestedSessionScope
	);
	const failureMessage = walletResolutionFailureMessage(status);
	const resolutionCopy = walletResolutionCopy(
		{
			...status,
			discovered: walletAnnouncementProgress.current.discovered,
			revalidated: walletAnnouncementProgress.current.revalidated,
		},
		failureMessage
	);

	return {
		gateway,
		results: visibleResults,
		status,
		failureMessage,
		resolutionCopy,
		refresh,
		retryDiscovery,
		retryUnavailable,
	};
}
