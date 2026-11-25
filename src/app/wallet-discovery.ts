import {
	type AssetCandidate,
	createAssetCandidateResolver,
	partitionAssetCandidateSupport,
	resolveAssetCandidates,
	type ResolvedAsset,
	verifyAssetCandidateSupport,
	type WalletCandidateScan,
} from 'api/asset-discovery';
import type { ComputeResult } from 'api/asset-marketplace';
import { type AssetSummary, type Collection, collectionAsset, preferResolvedAssetName } from 'api/collections';

import {
	type CandidateSupportFailure,
	refreshCandidateRetryMetadata,
	reopenWalletCandidate,
	trackRateLimitFailure,
	updateWalletResolvedAsset,
	type WalletDiscoverySession,
	type WalletResolutionStatus,
} from './App';
import { sameListingPresentation } from './home-listing-crawl';
import { marketplaceFailureKind, marketplaceRequestFailureMessage } from './marketplace-error';

/** Per-candidate failure bookkeeping shared with the route's Retry action. */
export type WalletDiscoveryFailures = {
	compute: Map<string, AssetCandidate>;
	support: Map<string, CandidateSupportFailure>;
	computeRateLimits: Set<string>;
	indexRateLimits: Set<string>;
};

export type WalletDiscoveryOptions = {
	address: string;
	session: WalletDiscoverySession;
	signal: AbortSignal;
	/** Read on every classification so collections that stream in later are honoured. */
	collections: () => Collection[];
	/**
	 * False while collections are still streaming in. The run then holds its
	 * finish while candidates wait on a collection, so it never reports done
	 * (or an empty wallet) before every collection had a chance to classify them.
	 */
	collectionsLoaded?: () => boolean;
	failures: WalletDiscoveryFailures;
	/** Pages the wallet's candidate history into `onPage` and returns every candidate found. */
	discover: (
		scan: WalletCandidateScan,
		onPage: (candidates: AssetCandidate[]) => void,
		signal: AbortSignal
	) => Promise<AssetCandidate[]>;
	read: (processId: string, signal?: AbortSignal) => Promise<ComputeResult>;
	verify?: typeof verifyAssetCandidateSupport;
	/** False once the run was aborted or a newer session replaced this one. */
	active: () => boolean;
	setStatus: (update: (current: WalletResolutionStatus) => WalletResolutionStatus) => void;
	/** The session's resolved assets or candidate previews changed; the caller schedules a render. */
	onResultsChanged: () => void;
	/** Candidate discovery finished without an index failure. */
	onDiscoveryComplete?: () => void;
	/** The run reached the done phase; the caller flushes results immediately. */
	onComplete?: () => void;
};

export type WalletDiscovery = {
	/** Settles once discovery, support verification, the initial resolver and revalidations drain. */
	finished: Promise<void>;
	/**
	 * Re-filters candidates and resolved assets against the current collections
	 * without restarting discovery or aborting in-flight reads.
	 */
	supportChanged(): void;
};

export function runWalletDiscovery(options: WalletDiscoveryOptions): WalletDiscovery {
	const { address, session, signal, failures, active, setStatus } = options;
	const verify = options.verify ?? verifyAssetCandidateSupport;
	const scheduled = new Set<string>();
	// Candidates no loaded collection can classify yet.
	const held = new Map<string, AssetCandidate>();
	// Candidates the GraphQL support check excluded; a collection index that loads later can still include them.
	const excluded = new Map<string, AssetCandidate>();
	// Reads whose state no loaded collection could classify yet, kept so a
	// collection that streams in later classifies them without another compute read.
	const unclassified = new Map<string, ComputeResult>();
	const settling = new Map<string, ComputeResult>();
	const revalidations: Promise<unknown>[] = [];
	const read = async (processId: string, readSignal?: AbortSignal) => {
		const result = await options.read(processId, readSignal);
		settling.set(processId, result);
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
	const resolverOptions = {
		signal,
		requireHolderBalances: true,
		read,
		onSettled: (result: ResolvedAsset | null, candidate: AssetCandidate, error?: unknown) => {
			if (!active()) return;
			const latest = session.latestCandidates.get(candidate.processId) ?? candidate;
			const computed = settling.get(candidate.processId);
			settling.delete(candidate.processId);
			if (!error && !result && computed) unclassified.set(candidate.processId, computed);
			else unclassified.delete(candidate.processId);
			session.screened.add(candidate.processId);
			session.completed.add(candidate.processId);
			if (error) failures.compute.set(candidate.processId, latest);
			else failures.compute.delete(candidate.processId);
			trackRateLimitFailure(failures.computeRateLimits, candidate.processId, error);
			setStatus((current) => ({
				...current,
				resolved: current.resolved + 1,
				failures: current.failures + (error ? 1 : 0),
				rateLimited: current.rateLimited + (error && marketplaceFailureKind(error) === 'rate-limited' ? 1 : 0),
			}));
			if (!error) updateWalletResolvedAsset(session, result, latest, address);
			// A settled candidate leaves the preview set whether or not the wallet holds it.
			options.onResultsChanged();
		},
		onRevalidated: (result: ResolvedAsset | null, candidate: AssetCandidate, error?: unknown) => {
			if (!active()) return;
			const latest = session.latestCandidates.get(candidate.processId) ?? candidate;
			if (error) failures.compute.set(candidate.processId, latest);
			else failures.compute.delete(candidate.processId);
			trackRateLimitFailure(failures.computeRateLimits, candidate.processId, error);
			if (error) {
				if (session.resolvedAssets.delete(candidate.processId)) options.onResultsChanged();
			} else if (updateWalletResolvedAsset(session, result, latest, address)) {
				options.onResultsChanged();
			}
			setStatus((current) => ({
				...current,
				revalidated: (current.revalidated ?? 0) + 1,
				failures: current.failures + (error ? 1 : 0),
				rateLimited: current.rateLimited + (error && marketplaceFailureKind(error) === 'rate-limited' ? 1 : 0),
			}));
		},
	};
	const resolver = createAssetCandidateResolver(options.collections, resolverOptions);
	let sealed = false;
	let lateResolver: ReturnType<typeof createAssetCandidateResolver> | undefined;
	const enqueue = (candidates: AssetCandidate[]) => {
		if (!candidates.length || signal.aborted) return;
		if (!sealed) {
			resolver.enqueue(candidates);
			return;
		}
		// Support that arrives after the run drained still resolves, through a
		// resolver nobody awaits, so the finished run stays finished.
		lateResolver ??= createAssetCandidateResolver(options.collections, resolverOptions);
		lateResolver.enqueue(candidates);
	};
	let supportTail = Promise.resolve();
	let wake: (() => void) | undefined;
	const resolvePage = (page: AssetCandidate[]) => {
		let reopened = 0;
		let reopenedFailures = 0;
		let reopenedIndexFailures = 0;
		let reopenedRateLimits = 0;
		let reopenedIndexRateLimits = 0;
		for (const candidate of page) {
			const wasComputeFailure = failures.compute.has(candidate.processId);
			const wasIndexFailure = failures.support.has(candidate.processId);
			const wasComputeRateLimited = failures.computeRateLimits.has(candidate.processId);
			const wasIndexRateLimited = failures.indexRateLimits.has(candidate.processId);
			const refresh = reopenWalletCandidate(session, candidate);
			if (refresh.completed) {
				reopened += 1;
				reopenedFailures += Number(wasComputeFailure || wasIndexFailure);
				reopenedIndexFailures += Number(wasIndexFailure);
				reopenedRateLimits += Number(wasComputeRateLimited || wasIndexRateLimited);
				reopenedIndexRateLimits += Number(wasIndexRateLimited);
			}
			if (refresh.reopened) {
				failures.compute.delete(candidate.processId);
				failures.support.delete(candidate.processId);
				failures.computeRateLimits.delete(candidate.processId);
				failures.indexRateLimits.delete(candidate.processId);
				scheduled.delete(candidate.processId);
				excluded.delete(candidate.processId);
				unclassified.delete(candidate.processId);
				if (refresh.removedResult) options.onResultsChanged();
			}
			session.latestCandidates.set(candidate.processId, candidate);
			if (held.has(candidate.processId)) held.set(candidate.processId, candidate);
			refreshCandidateRetryMetadata(candidate, failures.compute, failures.support);
			const existing = session.resolvedAssets.get(candidate.processId);
			if (existing) {
				session.resolvedAssets.set(candidate.processId, { ...existing, activity: candidate });
				options.onResultsChanged();
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
		const collections = options.collections();
		const unchecked = page.filter(
			(candidate) => !session.screened.has(candidate.processId) && !scheduled.has(candidate.processId)
		);
		const { supported, unverified } = partitionAssetCandidateSupport(unchecked, collections);
		const candidates = [...supported, ...unverified];
		for (const candidate of candidates) {
			scheduled.add(candidate.processId);
			held.delete(candidate.processId);
		}
		const candidateIds = new Set(candidates.map((candidate) => candidate.processId));
		for (const candidate of unchecked) {
			if (candidateIds.has(candidate.processId)) continue;
			session.screened.add(candidate.processId);
			held.set(candidate.processId, candidate);
		}
		const newlyCounted = candidates.filter((candidate) => !session.counted.has(candidate.processId));
		for (const candidate of newlyCounted) session.counted.add(candidate.processId);
		if (newlyCounted.length) options.onResultsChanged();
		if (active()) {
			setStatus((current) => ({
				...current,
				phase: candidates.length && current.phase !== 'done' ? 'resolving' : current.phase,
				discovered: session.latestCandidates.size,
				total: current.total + newlyCounted.length,
			}));
		}
		enqueue(supported);
		if (!unverified.length) return;
		supportTail = supportTail.then(async () => {
			const verification = await verify(unverified, collections, {
				signal,
				onVerified: (verified) => enqueue(verified),
			});
			if (!active()) return;
			for (const candidate of unverified) failures.support.delete(candidate.processId);
			for (const failure of verification.unavailable) {
				failures.support.set(failure.candidate.processId, failure);
				trackRateLimitFailure(failures.indexRateLimits, failure.candidate.processId, failure.error);
			}
			for (const candidate of unverified) {
				if (!failures.support.has(candidate.processId)) failures.indexRateLimits.delete(candidate.processId);
			}
			const verifiedIds = new Set(verification.supported.map((candidate) => candidate.processId));
			for (const candidate of unverified) {
				if (verifiedIds.has(candidate.processId)) continue;
				session.screened.add(candidate.processId);
				if (!failures.support.has(candidate.processId)) excluded.set(candidate.processId, candidate);
			}
			const checkedWithoutCompute = unverified.length - verification.supported.length;
			const rateLimited = verification.unavailable.filter(
				(failure) => marketplaceFailureKind(failure.error) === 'rate-limited'
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
		});
		// `finished` awaits the chain; this branch only keeps work queued after an
		// abort, or after the run drained, from surfacing as an unhandled rejection.
		void supportTail.catch(() => undefined);
	};

	const reclassify = () => {
		const current = [...session.resolvedAssets.values()];
		const computed = new Map<string, ComputeResult>(
			current.map((result) => [result.activity.processId, { state: result.state, provider: result.provider }])
		);
		for (const [processId, result] of unclassified) computed.set(processId, result);
		if (!computed.size) return;
		const candidates = [...computed.keys()].flatMap((processId) => {
			const latest = session.latestCandidates.get(processId) ?? session.resolvedAssets.get(processId)?.activity;
			return latest ? [latest] : [];
		});
		// The stored state is reused: only the collection lookup changed, so no
		// compute request is repeated.
		void resolveAssetCandidates(candidates, options.collections(), {
			signal,
			concurrency: 16,
			requireHolderBalances: true,
			read: async (processId) => computed.get(processId)!,
			onSettled: (result, candidate, cause) => {
				if (cause || !result || !active()) return;
				if (unclassified.delete(candidate.processId)) {
					if (updateWalletResolvedAsset(session, result, candidate, address)) options.onResultsChanged();
					return;
				}
				const previous = session.resolvedAssets.get(candidate.processId);
				if (!previous || sameListingPresentation(previous, result)) return;
				if (updateWalletResolvedAsset(session, result, previous.activity, address)) {
					options.onResultsChanged();
				}
			},
		}).catch(() => undefined);
	};

	const supportChanged = () => {
		if (signal.aborted || !active()) return;
		const collections = options.collections();
		const reopen: AssetCandidate[] = [];
		if (held.size) {
			const { supported, unverified } = partitionAssetCandidateSupport([...held.values()], collections);
			for (const candidate of [...supported, ...unverified]) {
				held.delete(candidate.processId);
				session.screened.delete(candidate.processId);
				reopen.push(candidate);
			}
		}
		let reopenedChecks = 0;
		if (excluded.size) {
			const { supported } = partitionAssetCandidateSupport([...excluded.values()], collections);
			for (const candidate of supported) {
				excluded.delete(candidate.processId);
				scheduled.delete(candidate.processId);
				session.screened.delete(candidate.processId);
				if (session.completed.delete(candidate.processId)) reopenedChecks += 1;
				reopen.push(candidate);
			}
		}
		if (reopenedChecks) {
			setStatus((current) => ({ ...current, resolved: Math.max(0, current.resolved - reopenedChecks) }));
		}
		if (reopen.length) {
			resolvePage(reopen.map((candidate) => session.latestCandidates.get(candidate.processId) ?? candidate));
		}
		reclassify();
		// Newly loaded collection indexes can name candidates that are still being checked.
		options.onResultsChanged();
		const resume = wake;
		wake = undefined;
		resume?.();
	};

	const finished = (async () => {
		try {
			const pendingCandidates = [...session.latestCandidates.values()].filter(
				(candidate) => !session.screened.has(candidate.processId)
			);
			if (pendingCandidates.length) resolvePage(pendingCandidates);
			let discoveredCandidates: AssetCandidate[] = [];
			let discoveryFailure: unknown;
			try {
				discoveredCandidates = await options.discover(session.scan, resolvePage, signal);
			} catch (cause) {
				discoveryFailure = cause;
			}
			if (!active()) return;
			if (!discoveryFailure) options.onDiscoveryComplete?.();
			// When the index fails, the candidates this scan already knew (a stored or earlier scan) are still
			// this wallet's history: check their live state rather than show nothing. The failure is still
			// reported, so the inventory says it may be incomplete.
			if (discoveryFailure) discoveredCandidates = [...session.scan.found.values()];
			resolvePage(discoveredCandidates.filter((candidate) => !session.screened.has(candidate.processId)));
			let resolutionFailure: unknown;
			for (;;) {
				try {
					await supportTail;
				} catch (cause) {
					resolutionFailure = cause;
					break;
				}
				const waiting = held.size + excluded.size + unclassified.size;
				if (discoveryFailure || options.collectionsLoaded?.() !== false || !waiting) break;
				// Candidates still depend on collections that are streaming in;
				// supportChanged() wakes the run once they change.
				await new Promise<void>((resolve) => {
					wake = resolve;
					signal.addEventListener('abort', () => resolve(), { once: true });
				});
				if (!active()) return;
			}
			sealed = true;
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
				options.onComplete?.();
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

	return { finished, supportChanged };
}

export type WalletCandidatePreview = {
	asset: AssetSummary;
	collection: Collection;
	activity: AssetCandidate;
	/** `checking` while live state is read; `unavailable` once that read failed or timed out. */
	state: 'checking' | 'unavailable';
};

function walletCandidateSummary(candidate: AssetCandidate, collections: Collection[]) {
	for (const collection of collections) {
		if (collection.kind === 'names') continue;
		const asset = collectionAsset(collection, candidate.processId);
		if (asset) return { asset, collection };
	}
	const names = collections.find((collection) => collection.kind === 'names');
	const name = names ? collectionAsset(names, candidate.processId) : undefined;
	return names && name ? { asset: name, collection: names } : undefined;
}

/**
 * Cards for candidates a loaded collection index already names (title, artwork),
 * shown from discovery data while their live state is read. A confirmed asset
 * replaces its preview in place; a candidate the wallet no longer holds drops
 * out once its read settles; a failed read stays as `unavailable`.
 */
export function walletCandidatePreviews(
	session: WalletDiscoverySession,
	collections: Collection[],
	computeFailures: ReadonlyMap<string, AssetCandidate>
): WalletCandidatePreview[] {
	const previews: WalletCandidatePreview[] = [];
	for (const processId of session.counted) {
		if (session.resolvedAssets.has(processId)) continue;
		const failed = computeFailures.has(processId);
		if (!failed && session.completed.has(processId)) continue;
		const activity = session.latestCandidates.get(processId);
		const summary = activity ? walletCandidateSummary(activity, collections) : undefined;
		if (activity && summary) previews.push({ ...summary, activity, state: failed ? 'unavailable' : 'checking' });
	}
	return previews;
}

/**
 * A wallet card's asset with the name (and artwork) the market store holds now. Previews and
 * confirmed cards keep the collection snapshot they were built from, so a short-ID title resolved
 * later by the batched name lookup would otherwise never reach them. Mirrors the home listing
 * shells, which take the current collection asset the same way.
 */
export function walletEntryWithCurrentName(
	asset: AssetSummary,
	collection: Collection,
	collections: readonly Collection[]
): AssetSummary {
	if (collection.kind !== 'images') return asset;
	const currentCollection = collections.find((candidate) => candidate.id === collection.id);
	const currentAsset = currentCollection ? collectionAsset(currentCollection, asset.id) : undefined;
	const named = preferResolvedAssetName(asset, currentAsset);
	return currentAsset?.image && !named.image ? { ...named, image: currentAsset.image } : named;
}

/**
 * What an asset group heading counts: every card it shows, with the ones whose live state has not
 * confirmed them yet (still being read, or the read failed) named separately so the total is not
 * mistaken for confirmed holdings.
 */
export function walletAssetGroupCount(
	confirmed: number,
	previews: ReadonlyArray<Pick<WalletCandidatePreview, 'state'>>
) {
	const checking = previews.filter((preview) => preview.state === 'checking').length;
	const unverified = previews.length - checking;
	const shown = confirmed + previews.length;
	const detail = [
		checking ? `${checking.toLocaleString()} checking` : '',
		unverified ? `${unverified.toLocaleString()} unverified` : '',
	]
		.filter(Boolean)
		.join(' · ');
	return { shown, checking, unverified, detail };
}
