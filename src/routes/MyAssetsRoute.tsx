import React from 'react';
import { RefreshCw, Server } from 'lucide-react';

import {
	type AssetCandidate,
	createWalletCandidateScan,
	discoverWalletAssetCandidates,
	loadCompletedWalletCandidateScan,
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
import { sameAccount } from 'helpers/host-account';
import { scheduleIdleTask } from 'helpers/idle';
import {
	assetGroupRevealAnnouncement,
	assetGroupRevealComplete,
	retainedAssetGroupLimit,
} from 'helpers/progressive-assets';
import { applyStableOrder } from 'helpers/stable-order';
import { useIndexedAssetNames } from 'hooks/useIndexedAssetNames';
import { useProgressiveReveal } from 'hooks/useProgressiveReveal';
import { useGridReorderMotion, useStableOrder } from 'hooks/useStableOrder';
import { useWallet } from 'providers/WalletProvider';

import {
	AssetCard,
	type CandidateSupportFailure,
	homeListingSupportVersion,
	initialWalletResolutionStatus,
	MarketContext,
	MarketSelect,
	nextWalletAnnouncementProgress,
	orderPriceLabel,
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
	walletUnavailableCandidatesCopy,
} from '../app/App';
import {
	marketplaceErrorMessage as errorMessage,
	marketplaceFailureKind,
	marketplaceRequestFailureMessage,
} from '../app/marketplace-error';
import {
	runWalletDiscovery,
	walletAssetGroupCount,
	type WalletCandidatePreview,
	walletCandidatePreviews,
	type WalletDiscovery,
	walletEntryWithCurrentName,
} from '../app/wallet-discovery';

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
	const [previews, setPreviews] = React.useState<WalletCandidatePreview[]>([]);
	const [storedStatus, setStatus] = React.useState<WalletResolutionStatus>(initialWalletResolutionStatus);
	const collectionsReady = market.collections.length > 0;
	const marketCollectionsRef = React.useRef(market.collections);
	marketCollectionsRef.current = market.collections;
	const marketLoadingRef = React.useRef(market.loading);
	marketLoadingRef.current = market.loading;
	const walletSupportVersion = React.useMemo(
		() => homeListingSupportVersion(market.collections),
		[market.collections]
	);
	const walletDiscovery = React.useRef<WalletDiscovery>();
	const discoveryScope = walletAddress ? walletDiscoveryScope(walletAddress, gateway) : '';
	const requestedSessionScope = discoveryScope ? `${discoveryScope}|refresh:${retry}` : '';
	const sessionIsCurrent = walletDiscoverySessionIsCurrent(discoverySession.current, requestedSessionScope);
	const visibleResults = sessionIsCurrent ? results : [];
	const visiblePreviews = sessionIsCurrent ? previews : [];
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
		// The GraphQL scan starts at once, in parallel with the collection reads: candidates no loaded
		// collection can classify yet are held, and supportChanged() releases them as collections stream
		// in, so nothing is read or shown before hidden-collection visibility has settled.
		if (!walletAddress || market.error) return;
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
			setPreviews(walletCandidatePreviews(session, marketCollectionsRef.current, failedCandidates.current));
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
			setPreviews([]);
			setStatus(initialWalletResolutionStatus());
		} else {
			setStatus((current) => ({ ...current, phase: 'discovering', error: null }));
			scheduleResults();
		}
		// Collections are read through the ref so streaming collections refine
		// support in place instead of restarting the wallet GraphQL scan and resolver.
		const discovery = runWalletDiscovery({
			address: walletAddress,
			session,
			signal: controller.signal,
			collections: () => marketCollectionsRef.current,
			collectionsLoaded: () => !marketLoadingRef.current,
			failures: {
				compute: failedCandidates.current,
				support: supportFailures.current,
				computeRateLimits: computeRateLimits.current,
				indexRateLimits: indexRateLimits.current,
			},
			discover: (walletScan, onPage, signal) =>
				discoverWalletAssetCandidates(walletAddress, { signal, scan: walletScan, catchUp: true, onPage }),
			read: (processId, signal) =>
				readAssetStateCached(processId, {
					force: true,
					maxAge: 0,
					maxAttempts: 1,
					signal,
					...(retry === 0 ? { staleWhileRevalidate: DISPLAY_STATE_CACHE.staleWhileRevalidate } : {}),
				}),
			active,
			setStatus,
			onResultsChanged: scheduleResults,
			onDiscoveryComplete: () => {
				cancelScanStore = scheduleIdleTask(
					() => storeCompletedWalletCandidateScan(window.localStorage, session.scan),
					500
				);
			},
			onComplete: () => {
				if (renderFrame !== undefined) window.cancelAnimationFrame(renderFrame);
				flushResults();
			},
		});
		walletDiscovery.current = discovery;
		return () => {
			if (walletDiscovery.current === discovery) walletDiscovery.current = undefined;
			controller.abort();
			cancelScanStore?.();
			if (renderFrame !== undefined) window.cancelAnimationFrame(renderFrame);
		};
	}, [discoveryRetry, discoveryScope, market.error, retry]);
	React.useEffect(() => {
		walletDiscovery.current?.supportChanged();
	}, [market.loading, walletSupportVersion]);
	React.useEffect(() => {
		if (
			!failedRetry ||
			!walletAddress ||
			!collectionsReady ||
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
			resolveAssetCandidates(failed, marketCollectionsRef.current, {
				signal: controller.signal,
				requireHolderBalances: true,
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
				? await verifyAssetCandidateSupport(unverified, marketCollectionsRef.current, {
						signal: controller.signal,
				  })
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
				setPreviews(walletCandidatePreviews(session, marketCollectionsRef.current, failedCandidates.current));
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
	}, [collectionsReady, failedRetry, market.error, requestedSessionScope, walletAddress]);

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
	const tokenPreviews =
		tokenView === 'all' ? visiblePreviews.filter((preview) => preview.collection.kind === 'tokens') : [];
	const uniquePreviews =
		uniqueView === 'all' ? visiblePreviews.filter((preview) => preview.collection.kind !== 'tokens') : [];
	const failureBlock = walletFailureBlock(status, visibleResults.length + visiblePreviews.length);
	const unavailableCopy = walletUnavailableCandidatesCopy(status, aggregateFailureMessage);
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
			{failureBlock === 'partial' ? (
				<div className="my-assets-heading-status retry-notice">
					<span role="status">{unavailableCopy}</span>
					<Button className="with-icon" type="button" onClick={retryUnavailableAssets} size="custom">
						<RefreshCw className="ui-icon ui-icon--sm" aria-hidden="true" /> Retry
					</Button>
				</div>
			) : null}
			<p className="sr-only" aria-live="polite" role="status">
				{walletStatusAnnouncement(failureBlock, status.failures, resolutionCopy.announcement)}
			</p>
			{working ? (
				<div className="my-assets-resolution-status" aria-busy="true">
					<div>
						<Loading label={resolutionCopy.heading} />
						<p>{resolutionCopy.announcement}</p>
					</div>
				</div>
			) : null}
			{failureBlock === 'error' ? (
				<div className="inline-error retry-notice">
					<span role="status">{status.error}</span>
					<Button className="with-icon" onClick={retryDiscovery} size="custom">
						<RefreshCw className="ui-icon ui-icon--sm" aria-hidden="true" /> Retry
					</Button>
				</div>
			) : null}
			{!working || visibleResults.length || visiblePreviews.length ? (
				<>
					<AssetGroup
						title="Tokens"
						results={tokenResults}
						previews={tokenPreviews}
						address={walletAddress}
						kind="tokens"
						onViewChange={setTokenView}
						settled={status.phase === 'done'}
						unavailable={status.phase === 'error'}
						view={tokenView}
					/>
					<AssetGroup
						title="Uniques"
						results={uniqueResults}
						previews={uniquePreviews}
						address={walletAddress}
						kind="uniques"
						onViewChange={setUniqueView}
						settled={status.phase === 'done'}
						unavailable={status.phase === 'error'}
						view={uniqueView}
					/>
				</>
			) : null}
			{failureBlock === 'empty' ? (
				<div className="empty-state">
					<h3>
						{status.failures
							? 'Ownership could not be checked'
							: 'No indexed candidates currently resolve to this address'}
					</h3>
					{status.failures ? (
						<p role="status">{unavailableCopy}</p>
					) : (
						<p>
							Arweave GraphQL discovers candidates and can lag behind new transactions. Newly indexed
							candidates appear the next time this profile opens; live state remains authoritative for
							every candidate found.
						</p>
					)}
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

export type WalletFailureBlock = 'none' | 'error' | 'partial' | 'empty';

/**
 * The wallet assets surface shows at most one failure block: the discovery error
 * notice, a partial-failure banner above assets that are actually visible, or the
 * empty state (which carries its own failure copy and Retry). A partial-failure
 * banner never stacks above an empty state saying the same thing.
 */
/**
 * What an empty asset group says. After a discovery error nothing more is being checked, so it must
 * not keep saying "Checking…" under the error notice, nor claim there are no assets.
 */
export function walletAssetGroupEmptyCopy(assetLabel: string, settled: boolean, unavailable: boolean) {
	if (settled) return `No ${assetLabel}.`;
	return unavailable ? `Could not check for ${assetLabel}.` : `Checking for ${assetLabel}…`;
}

export function walletFailureBlock(
	status: Pick<WalletResolutionStatus, 'error' | 'failures' | 'phase'>,
	visibleCount: number
): WalletFailureBlock {
	if (status.error) return 'error';
	if (status.phase !== 'done') return 'none';
	if (!visibleCount) return 'empty';
	return status.failures ? 'partial' : 'none';
}

/**
 * The polite status region carries progress. Once a visible notice states the
 * outcome (with its own status role and Retry), the region is cleared so the
 * surface shows and announces one live-state message instead of two.
 */
export function walletStatusAnnouncement(failureBlock: WalletFailureBlock, failures: number, announcement: string) {
	if (failureBlock === 'error' || failureBlock === 'partial') return '';
	if (failureBlock === 'empty' && failures) return '';
	return announcement;
}

export function listedUniquePrice(result: ResolvedAsset, address: string): string | undefined {
	if (result.collection.kind === 'tokens') return undefined;
	const order = liveOrdersOfAsset(result.state).find((candidate) => sameAccount(candidate.creator, address));
	return order ? orderPriceLabel(order, result.state) : undefined;
}

export type WalletAssetGroupEntry =
	| { id: string; result: ResolvedAsset; preview?: undefined }
	| { id: string; result?: undefined; preview: WalletCandidatePreview };

/**
 * Confirmed assets and discovery previews in one activity order, newest first.
 * A preview sits where its confirmed card will appear, so confirming it updates
 * the card in place instead of moving it.
 */
export function walletAssetGroupEntries(
	results: ResolvedAsset[],
	previews: WalletCandidatePreview[]
): WalletAssetGroupEntry[] {
	const entries: Array<WalletAssetGroupEntry & { activity: AssetCandidate }> = [
		...results.map((result) => ({ id: result.asset.id, result, activity: result.activity })),
		...previews.map((preview) => ({ id: preview.asset.id, preview, activity: preview.activity })),
	];
	entries.sort((a, b) => b.activity.height - a.activity.height || b.activity.timestamp - a.activity.timestamp);
	return entries.map(({ activity: _activity, ...entry }) => entry as WalletAssetGroupEntry);
}

const AssetGroup = React.memo(function AssetGroup({
	title,
	results,
	previews,
	address,
	kind,
	onViewChange,
	settled,
	unavailable,
	view,
}: {
	title: string;
	results: ResolvedAsset[];
	previews: WalletCandidatePreview[];
	address: string;
	kind: 'tokens' | 'uniques';
	onViewChange(view: 'all' | 'listed'): void;
	settled: boolean;
	/** Discovery ended in an error, so an empty group is unknown rather than empty or still checking. */
	unavailable: boolean;
	view: 'all' | 'listed';
}) {
	const { collections, rememberIndexedAssets } = React.useContext(MarketContext);
	const pageSize = useProgressiveAssetPageSize();
	const [limit, setLimit] = React.useState(pageSize);
	const gridId = React.useId();
	const resultSummaryRef = React.useRef<HTMLParagraphElement>(null);
	const rankedEntries = React.useMemo(() => walletAssetGroupEntries(results, previews), [previews, results]);
	// Cards already painted, confirmed or preview, keep their slots while ownership checks resolve; the
	// group re-ranks by activity when the viewer switches view or once wallet resolution is done.
	const order = useStableOrder(
		rankedEntries.map((entry) => entry.id),
		`${address}|${view}`,
		settled
	);
	const entries = React.useMemo(
		() => applyStableOrder(rankedEntries, order, (entry) => entry.id),
		[order, rankedEntries]
	);
	const gridRef = React.useRef<HTMLDivElement>(null);
	useGridReorderMotion(gridRef, order);
	// Shown cards, preview or confirmed, carry the name the market store holds now; short-ID titles
	// among them are asked for through the shared batched name lookup.
	const shownEntries = React.useMemo(
		() =>
			entries.slice(0, limit).map((entry) => {
				const source = entry.preview ?? entry.result;
				return { entry, asset: walletEntryWithCurrentName(source.asset, source.collection, collections) };
			}),
		[collections, entries, limit]
	);
	useIndexedAssetNames(
		shownEntries.flatMap(({ entry, asset }) =>
			(entry.preview ?? entry.result).collection.kind === 'images' ? [asset] : []
		),
		rememberIndexedAssets
	);
	const count = walletAssetGroupCount(results.length, previews);
	const resultCountRef = React.useRef(entries.length);
	const [revealAnnouncement, setRevealAnnouncement] = React.useState('');
	resultCountRef.current = entries.length;
	const assetLabel = `${view === 'listed' ? 'listed ' : ''}${kind}`;
	const revealNextAssetPage = React.useCallback(() => {
		setLimit((current) => {
			const nextLimit = Math.min(resultCountRef.current, current + pageSize);
			setRevealAnnouncement(assetGroupRevealAnnouncement(nextLimit, resultCountRef.current, assetLabel));
			return nextLimit;
		});
	}, [assetLabel, pageSize]);
	const progressiveRevealRef = useProgressiveReveal(limit < entries.length, revealNextAssetPage);
	React.useEffect(() => {
		setLimit(pageSize);
		setRevealAnnouncement('');
	}, [address, kind, view]);
	React.useEffect(() => setLimit((current) => retainedAssetGroupLimit(current, pageSize)), [pageSize]);
	return (
		<section className="asset-group">
			<div className="asset-group-title">
				<div className="asset-group-heading">
					<h2
						aria-label={`${title}, ${count.shown.toLocaleString()}${
							count.detail ? `, ${count.detail}` : ''
						}`}
					>
						{title}
					</h2>
					<span aria-hidden="true">{count.shown.toLocaleString()}</span>
					{count.detail ? (
						<small aria-hidden="true" className="asset-group-pending-count">
							{count.detail}
						</small>
					) : null}
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
			{entries.length ? (
				<>
					<div className="asset-grid" id={gridId} ref={gridRef}>
						{shownEntries.map(({ entry: { result, preview }, asset }, index) => {
							if (preview) {
								return (
									<AssetCard
										key={preview.asset.id}
										collection={preview.collection}
										asset={asset}
										orderId={preview.asset.id}
										badge={preview.state === 'unavailable' ? 'State unavailable' : 'Checking…'}
										priority={index < 2}
									/>
								);
							}
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
									asset={asset}
									orderId={result.asset.id}
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
							entries.length > pageSize && limit >= entries.length
								? 'collection-result-count reveal-complete'
								: 'sr-only'
						}
						ref={resultSummaryRef}
						tabIndex={-1}
					>
						{entries.length > pageSize && limit >= entries.length
							? `All ${entries.length.toLocaleString()} ${assetLabel} are shown.`
							: `Showing ${Math.min(
									limit,
									entries.length
							  ).toLocaleString()} of ${entries.length.toLocaleString()} ${assetLabel}.`}
					</p>
					<span aria-live="polite" className="sr-only" role="status">
						{revealAnnouncement}
					</span>
				</>
			) : (
				<p className="asset-group-empty">{walletAssetGroupEmptyCopy(assetLabel, settled, unavailable)}</p>
			)}
			{entries.length && limit < entries.length ? (
				<>
					<span aria-hidden="true" className="progressive-reveal-sentinel" ref={progressiveRevealRef} />
					<Button
						aria-controls={gridId}
						className="load-more"
						size="custom"
						onClick={() => {
							const nextLimit = Math.min(entries.length, limit + pageSize);
							setLimit(nextLimit);
							setRevealAnnouncement(assetGroupRevealAnnouncement(nextLimit, entries.length, assetLabel));
							window.requestAnimationFrame(() => {
								if (assetGroupRevealComplete(nextLimit, resultCountRef.current)) {
									resultSummaryRef.current?.focus();
								}
							});
						}}
					>
						Show {Math.min(pageSize, entries.length - limit).toLocaleString()} more {assetLabel}
					</Button>
				</>
			) : null}
		</section>
	);
});
