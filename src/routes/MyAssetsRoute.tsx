import React from 'react';
import { RefreshCw, Server } from 'lucide-react';

import {
	createWalletCandidateScan,
	discoverWalletAssetCandidates,
	partitionAssetCandidateSupport,
	resolveAssetCandidates,
	verifyAssetCandidateSupport,
	walletAssetGroups,
	type AssetCandidate,
	type ResolvedAsset,
} from 'api/asset-discovery';
import { listedBalanceOf, liquidBalanceOf, readAssetState, servingNodeOrigin } from 'api/asset-marketplace';
import { ConnectWalletButton } from 'components/ConnectWalletButton';
import { ErrorPanel } from 'components/ErrorPanel';
import { Loading } from 'components/Loading';
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
	groupWalletResults,
	initialWalletResolutionStatus,
	MarketContext,
	nextWalletAnnouncementProgress,
	reopenWalletCandidate,
	refreshCandidateRetryMetadata,
	RouteState,
	tokenBalanceLabel,
	trackRateLimitFailure,
	updateWalletResolvedAsset,
	useProgressiveAssetPageSize,
	walletDiscoveryScope,
	walletDiscoverySession,
	walletDiscoverySessionIsCurrent,
	walletPageResolutionQueue,
	walletResolutionCopy,
	walletResolutionMaxAge,
	type WalletAnnouncementProgress,
	type WalletDiscoverySession,
	type WalletResolutionStatus,
} from '../app/App';
import {
	marketplaceErrorMessage as errorMessage,
	marketplaceFailureKind,
	marketplaceRequestFailureMessage,
} from '../app/marketplace-error';

export default function MyAssetsRoute() {
	const market = React.useContext(MarketContext);
	const wallet = useWallet();
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
	const [storedStatus, setStatus] = React.useState<WalletResolutionStatus>(initialWalletResolutionStatus);
	const discoveryScope = wallet.address ? walletDiscoveryScope(wallet.address, gateway, market.collections) : '';
	const requestedSessionScope = discoveryScope ? `${discoveryScope}|refresh:${retry}` : '';
	const sessionIsCurrent = walletDiscoverySessionIsCurrent(discoverySession.current, requestedSessionScope);
	const visibleResults = sessionIsCurrent ? results : [];
	const status = sessionIsCurrent ? storedStatus : initialWalletResolutionStatus();
	const groupedResults = React.useMemo(
		() => (wallet.address ? groupWalletResults(visibleResults, wallet.address) : { owned: [], listed: [] }),
		[visibleResults, wallet.address],
	);
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
		if (!wallet.address || market.loading || market.error) return;
		const controller = new AbortController();
		const walletAddress = wallet.address;
		const scope = requestedSessionScope;
		const previousSession = discoverySession.current;
		const session = walletDiscoverySession(previousSession, scope, walletAddress);
		const reset = session !== previousSession;
		discoverySession.current = session;
		const active = () => !controller.signal.aborted && discoverySession.current === session;
		let renderFrame: number | undefined;
		const flushResults = () => {
			renderFrame = undefined;
			if (!active()) return;
			setResults(
				[...session.resolvedAssets.values()].sort(
					(a, b) => b.activity.height - a.activity.height || b.activity.timestamp - a.activity.timestamp,
				),
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
				const resolvePage = async (page: AssetCandidate[]) => {
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
					const unchecked = page.filter((candidate) => !session.screened.has(candidate.processId));
					const { supported, unverified } = partitionAssetCandidateSupport(unchecked, market.collections);
					const candidates = [...supported, ...unverified];
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
					const resolveSupported = (supportedCandidates: AssetCandidate[]) =>
						resolveAssetCandidates(supportedCandidates, market.collections, {
							signal: controller.signal,
							read: (processId, signal) =>
								readAssetState(processId, {
									signal,
									maxAge: walletResolutionMaxAge(retry),
								}),
							onSettled: (result, candidate, error) => {
								if (!active()) return;
								session.screened.add(candidate.processId);
								session.completed.add(candidate.processId);
								if (error) failedCandidates.current.set(candidate.processId, candidate);
								else failedCandidates.current.delete(candidate.processId);
								trackRateLimitFailure(computeRateLimits.current, candidate.processId, error);
								setStatus((current) => ({
									...current,
									resolved: current.resolved + 1,
									failures: current.failures + (error ? 1 : 0),
									rateLimited:
										current.rateLimited + (error && marketplaceFailureKind(error) === 'rate-limited' ? 1 : 0),
								}));
								if (!error && updateWalletResolvedAsset(session, result, candidate, walletAddress)) {
									scheduleResults();
								}
							},
						});
					const verifyUnindexed = async () => {
						if (!unverified.length) return;
						const verification = await verifyAssetCandidateSupport(unverified, market.collections, {
							signal: controller.signal,
						});
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
						const verifiedIds = new Set(verification.supported.map((candidate) => candidate.processId));
						for (const candidate of unverified) {
							if (!verifiedIds.has(candidate.processId)) session.screened.add(candidate.processId);
						}
						const checkedWithoutCompute = unverified.length - verification.supported.length;
						const rateLimited = verification.unavailable.filter(
							(failure) => marketplaceFailureKind(failure.error) === 'rate-limited',
						).length;
						if (checkedWithoutCompute && active()) {
							for (const candidate of unverified) {
								if (!verifiedIds.has(candidate.processId)) session.completed.add(candidate.processId);
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
						await resolveSupported(verification.supported);
					};
					await Promise.all([resolveSupported(supported), verifyUnindexed()]);
				};
				const pageQueue = walletPageResolutionQueue(resolvePage, controller.signal);
				const pendingCandidates = [...session.latestCandidates.values()].filter(
					(candidate) => !session.screened.has(candidate.processId),
				);
				if (pendingCandidates.length) await resolvePage(pendingCandidates);
				const discoveredCandidates = await discoverWalletAssetCandidates(walletAddress, {
					signal: controller.signal,
					scan: session.scan,
					catchUp: true,
					onPage: (page) => pageQueue.push(page),
				});
				if (!active()) return;
				await pageQueue.drain();
				await resolvePage(discoveredCandidates.filter((candidate) => !session.screened.has(candidate.processId)));
				const revalidationCandidates = [...session.resolvedAssets.keys()]
					.map((processId) => session.latestCandidates.get(processId))
					.filter((candidate): candidate is AssetCandidate => Boolean(candidate));
				if (revalidationCandidates.length && active()) {
					setStatus((current) => ({
						...current,
						phase: 'revalidating',
						discoveryComplete: true,
						revalidated: 0,
						revalidationTotal: revalidationCandidates.length,
					}));
					await resolveAssetCandidates(revalidationCandidates, market.collections, {
						signal: controller.signal,
						read: (processId, signal) => readAssetState(processId, { signal, maxAge: 0 }),
						onSettled: (result, candidate, error) => {
							if (!active()) return;
							if (error) failedCandidates.current.set(candidate.processId, candidate);
							else failedCandidates.current.delete(candidate.processId);
							trackRateLimitFailure(computeRateLimits.current, candidate.processId, error);
							if (error) {
								if (session.resolvedAssets.delete(candidate.processId)) scheduleResults();
							} else if (updateWalletResolvedAsset(session, result, candidate, walletAddress)) {
								scheduleResults();
							}
							setStatus((current) => ({
								...current,
								revalidated: (current.revalidated ?? 0) + 1,
								failures: current.failures + (error ? 1 : 0),
								rateLimited: current.rateLimited + (error && marketplaceFailureKind(error) === 'rate-limited' ? 1 : 0),
							}));
						},
					});
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
			if (renderFrame !== undefined) window.cancelAnimationFrame(renderFrame);
		};
	}, [discoveryRetry, discoveryScope, gateway, market.error, market.loading, retry, wallet.address]);
	React.useEffect(() => {
		if (
			!failedRetry ||
			!wallet.address ||
			market.loading ||
			market.error ||
			(!failedCandidates.current.size && !supportFailures.current.size)
		)
			return;
		const controller = new AbortController();
		const session = discoverySession.current;
		if (!walletDiscoverySessionIsCurrent(session, requestedSessionScope)) return;
		const active = () => !controller.signal.aborted && discoverySession.current === session;
		const walletAddress = wallet.address;
		const candidates = [...failedCandidates.current.values()];
		const unverified = [...supportFailures.current.values()].map(({ candidate }) => candidate);
		const retryCount = candidates.length + unverified.length;
		const retryComputeRateLimits = candidates.filter((candidate) =>
			computeRateLimits.current.has(candidate.processId),
		).length;
		const retryIndexRateLimits = unverified.filter((candidate) =>
			indexRateLimits.current.has(candidate.processId),
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
						rateLimited: current.rateLimited + (error && marketplaceFailureKind(error) === 'rate-limited' ? 1 : 0),
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
				if (!supportFailures.current.has(candidate.processId)) indexRateLimits.current.delete(candidate.processId);
			}
			const checkedWithoutCompute = unverified.length - verification.supported.length;
			const rateLimited = verification.unavailable.filter(
				(failure) => marketplaceFailureKind(failure.error) === 'rate-limited',
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
						(a, b) => b.activity.height - a.activity.height || b.activity.timestamp - a.activity.timestamp,
					),
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
			},
		);
		return () => controller.abort();
	}, [failedRetry, gateway, market.collections, market.error, market.loading, requestedSessionScope, wallet.address]);

	if (!wallet.address) {
		return (
			<section className="my-assets-page">
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
		return (
			<RouteState title="My assets">
				<Loading label="Reading the supported asset collections from Arweave…" />
			</RouteState>
		);
	}
	if (market.error) {
		return (
			<section className="my-assets-page">
				<p className="eyebrow">Live wallet inventory</p>
				<h1>My assets</h1>
				<ErrorPanel message={market.error} onRetry={market.retry} retryLabel="Retry asset index" />
			</section>
		);
	}
	const { owned, listed } = groupedResults;
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
		requestedSessionScope,
	);
	const resolutionCopy = walletResolutionCopy(
		{
			...status,
			discovered: walletAnnouncementProgress.current.discovered,
			revalidated: walletAnnouncementProgress.current.revalidated,
		},
		aggregateFailureMessage,
	);
	return (
		<section className="my-assets-page">
			<div className="my-assets-heading">
				<div>
					<p className="eyebrow">Live wallet inventory</p>
					<h1>My assets</h1>
					<p>Your assets, read from live Arweave state.</p>
					<span className="gateway-pill">
						<Server className="ui-icon ui-icon--xs" aria-hidden="true" /> Gateway{' '}
						<span className="gateway-pill-host" title={new URL(gateway).host}>
							{new URL(gateway).host}
						</span>
					</span>
				</div>
				{status.phase !== 'error' ? (
					<button className="with-icon" onClick={refreshAssets} disabled={working}>
						<RefreshCw className="ui-icon ui-icon--sm" aria-hidden="true" />
						{working ? 'Resolving…' : 'Refresh assets'}
					</button>
				) : null}
			</div>
			<p className="sr-only" aria-live="polite" role="status">
				{resolutionCopy.announcement}
			</p>
			{status.error ? (
				<div className="inline-error">
					<span role="alert">{status.error}</span>
					<div className="inline-error-actions">
						<button className="with-icon" onClick={retryDiscovery}>
							<RefreshCw className="ui-icon ui-icon--sm" aria-hidden="true" /> Retry from checkpoint
						</button>
						<button onClick={refreshAssets}>Restart discovery</button>
					</div>
				</div>
			) : null}
			{!status.error && status.phase === 'done' && status.failures && status.failures < status.total ? (
				<div className="inline-error">
					<span role="status">
						{aggregateFailureMessage} {status.failures.toLocaleString()}{' '}
						{status.failures === 1 ? 'candidate remains' : 'candidates remain'} unavailable. Resolved assets remain
						visible.
					</span>
					<button className="with-icon" type="button" onClick={retryUnavailableAssets}>
						<RefreshCw className="ui-icon ui-icon--sm" aria-hidden="true" />{' '}
						{status.rateLimited ? 'Retry later' : 'Retry unavailable'}
					</button>
				</div>
			) : null}
			<AssetGroup
				title="Listed for sale"
				results={listed}
				badge="For sale"
				address={wallet.address}
				group="listed"
				settled={status.phase === 'done'}
			/>
			<AssetGroup
				title="Owned"
				results={owned}
				badge="Owned"
				address={wallet.address}
				group="owned"
				settled={status.phase === 'done'}
			/>
			{status.phase === 'done' && !visibleResults.length ? (
				<div className="empty-state">
					<h3>
						{status.failures
							? 'Ownership could not be checked'
							: 'No indexed candidates currently resolve to your ownership'}
					</h3>
					<p>
						{status.failures
							? `${aggregateFailureMessage} ${status.failures} of ${status.total} candidates could not be checked. Retry them before treating this as an empty wallet.`
							: 'Arweave GraphQL discovers candidates and can lag behind new transactions. Refresh after indexing; live state remains authoritative for every candidate found.'}
					</p>
					{status.failures ? (
						<button className="with-icon" type="button" onClick={retryUnavailableAssets}>
							<RefreshCw className="ui-icon ui-icon--sm" aria-hidden="true" />{' '}
							{status.rateLimited ? 'Retry later' : 'Retry unavailable assets'}
						</button>
					) : null}
				</div>
			) : null}
		</section>
	);
}

const AssetGroup = React.memo(function AssetGroup({
	title,
	results,
	badge,
	address,
	group,
	settled,
}: {
	title: string;
	results: ResolvedAsset[];
	badge: string;
	address: string;
	group: 'owned' | 'listed';
	settled: boolean;
}) {
	const pageSize = useProgressiveAssetPageSize();
	const [limit, setLimit] = React.useState(pageSize);
	const gridId = React.useId();
	const resultSummaryRef = React.useRef<HTMLParagraphElement>(null);
	const resultCountRef = React.useRef(results.length);
	const [revealAnnouncement, setRevealAnnouncement] = React.useState('');
	resultCountRef.current = results.length;
	const assetLabel = group === 'owned' ? 'owned assets' : 'listed assets';
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
	}, [address, group]);
	React.useEffect(() => setLimit((current) => retainedAssetGroupLimit(current, pageSize)), [pageSize]);
	return (
		<section className="asset-group">
			<div className="asset-group-title">
				<h2 aria-label={`${title}, ${results.length.toLocaleString()}`}>{title}</h2>
				<span aria-hidden="true">{results.length.toLocaleString()}</span>
			</div>
			{results.length ? (
				<>
					<div className="asset-grid" id={gridId}>
						{results.slice(0, limit).map((result) => (
							<AssetCard
								key={result.asset.id}
								collection={result.collection}
								asset={result.asset}
								badge={badge}
								price={
									result.collection.kind === 'tokens'
										? `${tokenBalanceLabel(
												group === 'owned'
													? liquidBalanceOf(result.state, address)
													: listedBalanceOf(result.state, address),
												result.state,
											)} ${group === 'owned' ? 'liquid' : 'listed'}`
										: undefined
								}
							/>
						))}
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
							: `Showing ${Math.min(limit, results.length).toLocaleString()} of ${results.length.toLocaleString()} ${assetLabel}.`}
					</p>
					<span aria-live="polite" className="sr-only" role="status">
						{revealAnnouncement}
					</span>
				</>
			) : (
				<p className="asset-group-empty">{settled ? `No ${assetLabel}.` : `No ${assetLabel} loaded yet.`}</p>
			)}
			{results.length && limit < results.length ? (
				<>
					<span aria-hidden="true" className="progressive-reveal-sentinel" ref={progressiveRevealRef} />
					<button
						aria-controls={gridId}
						className="load-more"
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
					</button>
				</>
			) : null}
		</section>
	);
});
