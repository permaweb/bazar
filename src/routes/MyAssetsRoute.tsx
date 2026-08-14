import React from 'react';
import { RefreshCw, Server } from 'lucide-react';

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
	walletAssetGroups,
} from 'api/asset-discovery';
import { liquidBalanceOf, listedBalanceOf, liveOrdersOfAsset, servingNodeOrigin } from 'api/asset-marketplace';
import { DISPLAY_STATE_CACHE, readAssetStateCached } from 'api/asset-state-store';

import { Button } from 'components/Button';
import { ConnectWalletButton } from 'components/ConnectWalletButton';
import { ErrorPanel } from 'components/ErrorPanel';
import { Loading } from 'components/Loading';
import { Tooltip } from 'components/Tooltip';
import { scheduleIdleTask } from 'helpers/idle';
import {
	assetGroupRevealAnnouncement,
	assetGroupRevealComplete,
	retainedAssetGroupLimit,
} from 'helpers/progressive-assets';
import { useProgressiveReveal } from 'hooks/useProgressiveReveal';
import { useWallet } from 'providers/WalletProvider';

import {
	AssetCard,
	type CandidateSupportFailure,
	initialWalletResolutionStatus,
	MarketContext,
	MarketSelect,
	nextWalletAnnouncementProgress,
	orderPriceLabel,
	refreshCandidateRetryMetadata,
	reopenWalletCandidate,
	RouteState,
	tokenBalanceLabel,
	trackRateLimitFailure,
	updateWalletResolvedAsset,
	useProgressiveAssetPageSize,
	type WalletAnnouncementProgress,
	walletDiscoveryScope,
	type WalletDiscoverySession,
	walletDiscoverySession,
	walletDiscoverySessionIsCurrent,
	walletResolutionCopy,
	type WalletResolutionStatus,
} from '../app/App';
import {
	marketplaceErrorMessage as errorMessage,
	marketplaceFailureKind,
	marketplaceRequestFailureMessage,
} from '../app/marketplace-error';

export default function MyAssetsRoute({
	address,
	embedded = false,
}: {
	address?: string;
	embedded?: boolean;
} = {}) {
	const market = React.useContext(MarketContext);
	const wallet = useWallet();
	const walletAddress = address ?? wallet.address ?? '';
	const pageClassName = `my-assets-page${embedded ? ' profile-assets' : ''}`;
	const gateway = servingNodeOrigin(window.location);
	const [retry, setRetry] = React.useState(0);
	const [discoveryRetry, setDiscoveryRetry] = React.useState(0);
	const [failedRetry, setFailedRetry] = React.useState(0);
	const [tokenView, setTokenView] = React.useState<'all' | 'listed'>('all');
	const [uniqueView, setUniqueView] = React.useState<'all' | 'listed'>('all');
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
	const [storedStatus, setStatus] = React.useState<WalletResolutionStatus>(initialWalletResolutionStatus);
	const discoveryScope = walletAddress ? walletDiscoveryScope(walletAddress, gateway, market.collections) : '';
	const requestedSessionScope = discoveryScope ? `${discoveryScope}|refresh:${retry}` : '';
	const sessionIsCurrent = walletDiscoverySessionIsCurrent(discoverySession.current, requestedSessionScope);
	const visibleResults = sessionIsCurrent ? results : [];
	const status = sessionIsCurrent ? storedStatus : initialWalletResolutionStatus();
	const retryDiscovery = () => {
		setDiscoveryRetry((value) => value + 1);
	};
	const retryUnavailableAssets = () => {
		setFailedRetry((value) => value + 1);
	};
	const refreshAssets = () => {
		setRetry((value) => value + 1);
	};
	React.useEffect(() => {
		if (!walletAddress || !market.collections.length || market.error) return;
		const controller = new AbortController();
		const scope = requestedSessionScope;
		const previousSession = discoverySession.current;
		const scan =
			(previousSession?.scope === scope ? previousSession.scan : undefined) ??
			resumeCompletedWalletCandidateScan(previousSession?.scan, walletAddress) ??
			loadCompletedWalletCandidateScan(window.localStorage, walletAddress) ??
			createWalletCandidateScan(walletAddress);
		const session = walletDiscoverySession(previousSession, scope, walletAddress, scan);
		const reset = session !== previousSession;
		discoverySession.current = session;
		const active = () => !controller.signal.aborted && discoverySession.current === session;
		const revalidations: Promise<unknown>[] = [];
		let renderFrame: number | undefined;
		let cancelScanStore: (() => void) | undefined;
		const flushResults = () => {
			renderFrame = undefined;
			if (!active()) return;
			setResults(
				[...session.resolvedAssets.values()].sort(
					(a, b) => b.activity.height - a.activity.height || b.activity.timestamp - a.activity.timestamp
				)
			);
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
			setStatus(initialWalletResolutionStatus());
		} else {
			setStatus((current) => ({ ...current, phase: 'discovering', error: null }));
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
						if (active()) {
							setStatus((current) => ({
								...current,
								revalidationTotal: (current.revalidationTotal ?? 0) + 1,
							}));
						}
					}
					return result;
				};
				const resolver = createAssetCandidateResolver(market.collections, {
					signal: controller.signal,
					read: readWalletState,
					onSettled: (result, candidate, error) => {
						if (!active()) return;
						const latest = session.latestCandidates.get(candidate.processId) ?? candidate;
						session.screened.add(candidate.processId);
						session.completed.add(candidate.processId);
						if (error) failedCandidates.current.set(candidate.processId, latest);
						else failedCandidates.current.delete(candidate.processId);
						trackRateLimitFailure(computeRateLimits.current, candidate.processId, error);
						setStatus((current) => ({
							...current,
							resolved: current.resolved + 1,
							failures: current.failures + (error ? 1 : 0),
							rateLimited:
								current.rateLimited +
								(error && marketplaceFailureKind(error) === 'rate-limited' ? 1 : 0),
						}));
						if (!error && updateWalletResolvedAsset(session, result, latest, walletAddress))
							scheduleResults();
					},
					onRevalidated: (result, candidate, error) => {
						if (!active()) return;
						const latest = session.latestCandidates.get(candidate.processId) ?? candidate;
						if (error) failedCandidates.current.set(candidate.processId, latest);
						else failedCandidates.current.delete(candidate.processId);
						trackRateLimitFailure(computeRateLimits.current, candidate.processId, error);
						if (error) {
							if (session.resolvedAssets.delete(candidate.processId)) scheduleResults();
						} else if (updateWalletResolvedAsset(session, result, latest, walletAddress)) {
							scheduleResults();
						}
						setStatus((current) => ({
							...current,
							revalidated: (current.revalidated ?? 0) + 1,
							failures: current.failures + (error ? 1 : 0),
							rateLimited:
								current.rateLimited +
								(error && marketplaceFailureKind(error) === 'rate-limited' ? 1 : 0),
						}));
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
						const refresh = reopenWalletCandidate(session, candidate);
						if (refresh.completed) {
							reopened += 1;
							reopenedFailures += Number(wasComputeFailure || wasIndexFailure);
							reopenedIndexFailures += Number(wasIndexFailure);
							reopenedRateLimits += Number(wasComputeRateLimited || wasIndexRateLimited);
							reopenedIndexRateLimits += Number(wasIndexRateLimited);
						}
						if (refresh.reopened) {
							failedCandidates.current.delete(candidate.processId);
							supportFailures.current.delete(candidate.processId);
							computeRateLimits.current.delete(candidate.processId);
							indexRateLimits.current.delete(candidate.processId);
							if (refresh.removedResult) scheduleResults();
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
						setStatus((current) => ({
							...current,
							resolved: Math.max(0, current.resolved - reopened),
							failures: Math.max(0, current.failures - reopenedFailures),
							indexFailures: Math.max(0, current.indexFailures - reopenedIndexFailures),
							rateLimited: Math.max(0, current.rateLimited - reopenedRateLimits),
							indexRateLimited: Math.max(0, current.indexRateLimited - reopenedIndexRateLimits),
						}));
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
						setStatus((current) => ({
							...current,
							phase: candidates.length ? 'resolving' : current.phase,
							discovered: session.latestCandidates.size,
							total: current.total + newlyCounted.length,
						}));
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
								(failure) => marketplaceFailureKind(failure.error) === 'rate-limited'
							).length;
							if (checkedWithoutCompute && active()) {
								for (const candidate of unverified) {
									if (!verifiedIds.has(candidate.processId))
										session.completed.add(candidate.processId);
								}
								setStatus((current) => ({
									...current,
									resolved: current.resolved + checkedWithoutCompute,
									failures: current.failures + verification.unavailable.length,
									indexFailures: current.indexFailures + verification.unavailable.length,
									rateLimited: current.rateLimited + rateLimited,
									indexRateLimited: current.indexRateLimited + rateLimited,
								}));
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
					discoveredCandidates = await discoverWalletAssetCandidates(walletAddress, {
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
					setStatus((current) => ({
						...current,
						phase: 'revalidating',
						discoveryComplete: true,
					}));
					await Promise.allSettled(revalidations);
				}
				if (active()) {
					session.complete = true;
					if (renderFrame !== undefined) window.cancelAnimationFrame(renderFrame);
					flushResults();
					setStatus((current) => ({
						...current,
						phase: 'done',
						discoveryComplete: true,
						discovered: session.latestCandidates.size,
						revalidated: undefined,
						revalidationTotal: undefined,
					}));
				}
			} catch (cause) {
				if (active()) {
					setStatus((current) => ({
						...current,
						phase: 'error',
						error: marketplaceRequestFailureMessage('index', marketplaceFailureKind(cause)),
					}));
				}
			}
		})();
		return () => {
			controller.abort();
			cancelScanStore?.();
			if (renderFrame !== undefined) window.cancelAnimationFrame(renderFrame);
		};
	}, [discoveryRetry, discoveryScope, gateway, market.error, retry, walletAddress]);
	React.useEffect(() => {
		if (
			!failedRetry ||
			!walletAddress ||
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
		const unverified = [...supportFailures.current.values()].map(({ candidate }) => candidate);
		const retryCount = candidates.length + unverified.length;
		const retryComputeRateLimits = candidates.filter((candidate) =>
			computeRateLimits.current.has(candidate.processId)
		).length;
		const retryIndexRateLimits = unverified.filter((candidate) =>
			indexRateLimits.current.has(candidate.processId)
		).length;
		setStatus((current) => ({
			...current,
			phase: 'resolving',
			discoveryComplete: true,
			resolved: Math.max(0, current.resolved - retryCount),
			failures: Math.max(0, current.failures - retryCount),
			indexFailures: Math.max(0, current.indexFailures - unverified.length),
			rateLimited: Math.max(0, current.rateLimited - retryComputeRateLimits - retryIndexRateLimits),
			indexRateLimited: Math.max(0, current.indexRateLimited - retryIndexRateLimits),
			error: null,
		}));
		const resolveFailed = (failed: AssetCandidate[]) =>
			resolveAssetCandidates(failed, market.collections, {
				signal: controller.signal,
				onSettled: (result, candidate, error) => {
					if (!active()) return;
					if (error) failedCandidates.current.set(candidate.processId, candidate);
					else failedCandidates.current.delete(candidate.processId);
					trackRateLimitFailure(computeRateLimits.current, candidate.processId, error);
					if (!error) updateWalletResolvedAsset(session, result, candidate, walletAddress);
					setStatus((current) => ({
						...current,
						resolved: current.resolved + 1,
						failures: current.failures + (error ? 1 : 0),
						rateLimited:
							current.rateLimited + (error && marketplaceFailureKind(error) === 'rate-limited' ? 1 : 0),
					}));
				},
			});
		const retryUnavailable = async () => {
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
				(failure) => marketplaceFailureKind(failure.error) === 'rate-limited'
			).length;
			if (checkedWithoutCompute && active()) {
				setStatus((current) => ({
					...current,
					resolved: current.resolved + checkedWithoutCompute,
					failures: current.failures + verification.unavailable.length,
					indexFailures: current.indexFailures + verification.unavailable.length,
					rateLimited: current.rateLimited + rateLimited,
					indexRateLimited: current.indexRateLimited + rateLimited,
				}));
			}
			await resolveFailed([...candidates, ...verification.supported]);
		};
		void retryUnavailable().then(
			() => {
				if (!active()) return;
				setResults(
					[...session.resolvedAssets.values()].sort(
						(a, b) => b.activity.height - a.activity.height || b.activity.timestamp - a.activity.timestamp
					)
				);
				setStatus((current) => ({
					...current,
					phase: 'done',
					failures: failedCandidates.current.size + supportFailures.current.size,
					indexFailures: supportFailures.current.size,
					rateLimited: computeRateLimits.current.size + indexRateLimits.current.size,
					indexRateLimited: indexRateLimits.current.size,
				}));
			},
			(cause) => {
				if (active()) {
					setStatus((current) => ({ ...current, phase: 'error', error: errorMessage(cause) }));
				}
			}
		);
		return () => controller.abort();
	}, [failedRetry, gateway, market.collections, market.error, requestedSessionScope, walletAddress]);

	if (!walletAddress) {
		return (
			<section className={pageClassName}>
				<p className="eyebrow">Your wallet</p>
				<h1>My assets</h1>
				<div className="empty-state">
					<h3>Connect a wallet to resolve its assets</h3>
					<p>No signature is requested. Candidate history and live state are read-only.</p>
					<ConnectWalletButton />
				</div>
			</section>
		);
	}
	if (market.loading && !market.collections.length) {
		if (embedded) {
			return (
				<section className={pageClassName}>
					<Loading label="Reading supported asset collections from Arweave…" />
				</section>
			);
		}
		return (
			<RouteState title="My assets">
				<Loading label="Reading the supported asset collections from Arweave…" />
			</RouteState>
		);
	}
	if (market.error) {
		return (
			<section className={pageClassName}>
				{!embedded ? (
					<>
						<p className="eyebrow">Live wallet inventory</p>
						<h1>My assets</h1>
					</>
				) : null}
				<ErrorPanel message={market.error} onRetry={market.retry} />
			</section>
		);
	}
	const tokenResults = visibleResults.filter(
		(result) =>
			result.collection.kind === 'tokens' &&
			(tokenView === 'all' || walletAssetGroups(result, walletAddress).includes('listed'))
	);
	const uniqueResults = visibleResults.filter(
		(result) =>
			result.collection.kind !== 'tokens' &&
			(uniqueView === 'all' || walletAssetGroups(result, walletAddress).includes('listed'))
	);
	const working = status.phase === 'discovering' || status.phase === 'resolving' || status.phase === 'revalidating';
	const computeRateLimited = status.rateLimited - status.indexRateLimited;
	const computeFailures = status.failures - status.indexFailures;
	const aggregateFailureMessage = [
		status.indexFailures
			? marketplaceRequestFailureMessage('index', status.indexRateLimited ? 'rate-limited' : 'unavailable')
			: '',
		computeFailures
			? marketplaceRequestFailureMessage('compute', computeRateLimited ? 'rate-limited' : 'unavailable')
			: '',
	]
		.filter(Boolean)
		.join(' ');
	walletAnnouncementProgress.current = nextWalletAnnouncementProgress(
		walletAnnouncementProgress.current,
		status,
		requestedSessionScope
	);
	const resolutionCopy = walletResolutionCopy(
		{
			...status,
			discovered: walletAnnouncementProgress.current.discovered,
			revalidated: walletAnnouncementProgress.current.revalidated,
		},
		aggregateFailureMessage
	);
	return (
		<section className={pageClassName}>
			{!embedded ? (
				<div className="my-assets-heading">
					<div>
						<p className="eyebrow">Live wallet inventory</p>
						<h1>My assets</h1>
						<p>Your assets, read from live Arweave state.</p>
						<span className="gateway-pill">
							<Server className="ui-icon ui-icon--xs" aria-hidden="true" /> Gateway{' '}
							<Tooltip content={new URL(gateway).host}>
								{(tooltipId) => (
									<span aria-describedby={tooltipId} className="gateway-pill-host">
										{new URL(gateway).host}
									</span>
								)}
							</Tooltip>
						</span>
					</div>
				</div>
			) : null}
			{!status.error && status.phase === 'done' && status.failures && status.failures < status.total ? (
				<div className="my-assets-heading-status retry-notice">
					<span role="status">
						Compute hasn’t completed yet. Please try again. {status.failures.toLocaleString()}{' '}
						{status.failures === 1 ? 'candidate remains' : 'candidates remain'} unavailable. Resolved assets
						remain visible.
					</span>
					<Button className="with-icon" type="button" onClick={retryUnavailableAssets} size="custom">
						<RefreshCw className="ui-icon ui-icon--sm" aria-hidden="true" /> Retry
					</Button>
				</div>
			) : null}
			<p className="sr-only" aria-live="polite" role="status">
				{resolutionCopy.announcement}
			</p>
			{working ? (
				<div className="my-assets-resolution-status" aria-busy="true">
					<div>
						<Loading label={resolutionCopy.heading} />
						<p>{resolutionCopy.announcement}</p>
					</div>
				</div>
			) : null}
			{status.error ? (
				<div className="inline-error retry-notice">
					<span role="status">Compute hasn’t completed yet. Please try again.</span>
					<Button className="with-icon" onClick={retryDiscovery} size="custom">
						<RefreshCw className="ui-icon ui-icon--sm" aria-hidden="true" /> Retry
					</Button>
				</div>
			) : null}
			{!working || visibleResults.length ? (
				<>
					<AssetGroup
						title="Tokens"
						results={tokenResults}
						address={walletAddress}
						kind="tokens"
						onViewChange={setTokenView}
						settled={status.phase === 'done'}
						view={tokenView}
					/>
					<AssetGroup
						title="Uniques"
						results={uniqueResults}
						address={walletAddress}
						kind="uniques"
						onViewChange={setUniqueView}
						settled={status.phase === 'done'}
						view={uniqueView}
					/>
				</>
			) : null}
			{status.phase === 'done' && !visibleResults.length ? (
				<div className="empty-state">
					<h3>
						{status.failures
							? 'Ownership could not be checked'
							: 'No indexed candidates currently resolve to this address'}
					</h3>
					<p>
						{status.failures
							? `Compute hasn’t completed yet. Please try again. ${status.failures} of ${status.total} candidates still need to be checked.`
							: 'Arweave GraphQL discovers candidates and can lag behind new transactions. Newly indexed candidates appear the next time this profile opens; live state remains authoritative for every candidate found.'}
					</p>
					{status.failures ? (
						<Button
							className="with-icon retry-notice-action"
							type="button"
							onClick={retryUnavailableAssets}
							size="custom"
						>
							<RefreshCw className="ui-icon ui-icon--sm" aria-hidden="true" /> Retry
						</Button>
					) : null}
				</div>
			) : null}
		</section>
	);
}

export function listedUniquePrice(result: ResolvedAsset, address: string): string | undefined {
	if (result.collection.kind === 'tokens') return undefined;
	const order = liveOrdersOfAsset(result.state).find((candidate) => candidate.creator === address);
	return order ? orderPriceLabel(order, result.state) : undefined;
}

const AssetGroup = React.memo(function AssetGroup({
	title,
	results,
	address,
	kind,
	onViewChange,
	settled,
	view,
}: {
	title: string;
	results: ResolvedAsset[];
	address: string;
	kind: 'tokens' | 'uniques';
	onViewChange(view: 'all' | 'listed'): void;
	settled: boolean;
	view: 'all' | 'listed';
}) {
	const pageSize = useProgressiveAssetPageSize();
	const [limit, setLimit] = React.useState(pageSize);
	const gridId = React.useId();
	const resultSummaryRef = React.useRef<HTMLParagraphElement>(null);
	const resultCountRef = React.useRef(results.length);
	const [revealAnnouncement, setRevealAnnouncement] = React.useState('');
	resultCountRef.current = results.length;
	const assetLabel = `${view === 'listed' ? 'listed ' : ''}${kind}`;
	const revealNextAssetPage = React.useCallback(() => {
		setLimit((current) => {
			const nextLimit = Math.min(resultCountRef.current, current + pageSize);
			setRevealAnnouncement(assetGroupRevealAnnouncement(nextLimit, resultCountRef.current, assetLabel));
			return nextLimit;
		});
	}, [assetLabel, pageSize]);
	const progressiveRevealRef = useProgressiveReveal(limit < results.length, revealNextAssetPage);
	React.useEffect(() => {
		setLimit(pageSize);
		setRevealAnnouncement('');
	}, [address, kind, view]);
	React.useEffect(() => setLimit((current) => retainedAssetGroupLimit(current, pageSize)), [pageSize]);
	return (
		<section className="asset-group">
			<div className="asset-group-title">
				<div className="asset-group-heading">
					<h2 aria-label={`${title}, ${results.length.toLocaleString()}`}>{title}</h2>
					<span aria-hidden="true">{results.length.toLocaleString()}</span>
				</div>
				<MarketSelect<'all' | 'listed'>
					label={`${title} view`}
					onChange={onViewChange}
					options={[
						{ value: 'all', label: 'All assets' },
						{ value: 'listed', label: 'Listed for sale' },
					]}
					showLabel={false}
					value={view}
				/>
			</div>
			{results.length ? (
				<>
					<div className="asset-grid" id={gridId}>
						{results.slice(0, limit).map((result, index) => {
							const listed = walletAssetGroups(result, address).includes('listed');
							const listedBalance = listedBalanceOf(result.state, address);
							const uniquePrice = listed ? listedUniquePrice(result, address) : undefined;
							const balance =
								view === 'listed'
									? listedBalance
									: (
											BigInt(liquidBalanceOf(result.state, address)) + BigInt(listedBalance)
									  ).toString();
							return (
								<AssetCard
									key={result.asset.id}
									collection={result.collection}
									asset={result.asset}
									badge={view === 'listed' || listed ? 'For sale' : 'Owned'}
									priority={index < 2}
									price={
										result.collection.kind === 'tokens'
											? `${tokenBalanceLabel(balance, result.state)}${
													view === 'listed' ? ' listed' : ''
											  }`
											: uniquePrice
									}
									priceListed={Boolean(uniquePrice)}
								/>
							);
						})}
					</div>
					<p
						className={
							results.length > pageSize && limit >= results.length
								? 'collection-result-count reveal-complete'
								: 'sr-only'
						}
						ref={resultSummaryRef}
						tabIndex={-1}
					>
						{results.length > pageSize && limit >= results.length
							? `All ${results.length.toLocaleString()} ${assetLabel} are shown.`
							: `Showing ${Math.min(
									limit,
									results.length
							  ).toLocaleString()} of ${results.length.toLocaleString()} ${assetLabel}.`}
					</p>
					<span aria-live="polite" className="sr-only" role="status">
						{revealAnnouncement}
					</span>
				</>
			) : (
				<p className="asset-group-empty">{settled ? `No ${assetLabel}.` : `Checking for ${assetLabel}…`}</p>
			)}
			{results.length && limit < results.length ? (
				<>
					<span aria-hidden="true" className="progressive-reveal-sentinel" ref={progressiveRevealRef} />
					<Button
						aria-controls={gridId}
						className="load-more"
						size="custom"
						onClick={() => {
							const nextLimit = Math.min(results.length, limit + pageSize);
							setLimit(nextLimit);
							setRevealAnnouncement(assetGroupRevealAnnouncement(nextLimit, results.length, assetLabel));
							window.requestAnimationFrame(() => {
								if (assetGroupRevealComplete(nextLimit, resultCountRef.current)) {
									resultSummaryRef.current?.focus();
								}
							});
						}}
					>
						Show {Math.min(pageSize, results.length - limit).toLocaleString()} more {assetLabel}
					</Button>
				</>
			) : null}
		</section>
	);
});
