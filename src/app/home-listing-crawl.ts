import {
	type AssetCandidate,
	type AssetCandidateSupportResult,
	createAssetCandidateResolver,
	isLiveListing,
	partitionAssetCandidateSupport,
	resolveAssetCandidates,
	type ResolvedAsset,
	verifyAssetCandidateSupport,
} from 'api/asset-discovery';
import type { ComputeResult } from 'api/asset-marketplace';
import type { Collection } from 'api/collections';

type ListingCallback = (result: ResolvedAsset | null, candidate: AssetCandidate, error?: unknown) => void;

export type HomeListingCrawlOptions = {
	signal: AbortSignal;
	/** Read on every classification so collections that stream in later are honoured. */
	collections: () => Collection[];
	/** Pages listing activity, awaiting `onPage` before requesting the next page. */
	discover: (onPage: (candidates: AssetCandidate[]) => Promise<void>, signal: AbortSignal) => Promise<unknown>;
	read: (processId: string, signal?: AbortSignal) => Promise<ComputeResult>;
	verify?: (
		candidates: AssetCandidate[],
		collections: Collection[],
		options: { signal: AbortSignal; onVerified: (candidates: AssetCandidate[]) => void }
	) => Promise<AssetCandidateSupportResult>;
	concurrency?: number;
	onSettled?: ListingCallback;
	onRevalidated?: ListingCallback;
	/** A live listing whose collection or display metadata changed after collections grew. */
	onReclassified?: (result: ResolvedAsset | null, candidate: AssetCandidate) => void;
	onDiscoveryFailure?: (cause: unknown) => void;
	onIndexFailure?: (cause: unknown) => void;
};

export type HomeListingCrawl = {
	/** Settles once discovery, support verification and the initial resolver drain. */
	finished: Promise<void>;
	/**
	 * Re-filters discovered candidates and live listings against the current
	 * collections without restarting discovery or aborting in-flight reads.
	 */
	supportChanged(): void;
};

function sameListingPresentation(left: ResolvedAsset, right: ResolvedAsset) {
	return (
		left.collection.id === right.collection.id &&
		left.asset.id === right.asset.id &&
		left.asset.name === right.asset.name &&
		left.asset.image === right.asset.image &&
		left.asset.media === right.asset.media
	);
}

export function createHomeListingCrawl(options: HomeListingCrawlOptions): HomeListingCrawl {
	const { signal } = options;
	const verify = options.verify ?? verifyAssetCandidateSupport;
	// Candidates the current collections cannot classify yet, keyed by process.
	const held = new Map<string, AssetCandidate>();
	const verifying = new Set<string>();
	const verifiedIds = new Set<string>();
	const checkedIds = new Set<string>();
	const enqueued = new Set<string>();
	const live = new Map<string, ResolvedAsset>();
	let supportTail = Promise.resolve();
	let sealed = false;

	const track = (result: ResolvedAsset | null, candidate: AssetCandidate) => {
		if (result && isLiveListing(result)) live.set(candidate.processId, result);
		else live.delete(candidate.processId);
	};
	const resolverOptions = {
		signal,
		concurrency: options.concurrency,
		read: options.read,
		onSettled: (result: ResolvedAsset | null, candidate: AssetCandidate, cause?: unknown) => {
			if (signal.aborted) return;
			if (!cause) track(result, candidate);
			options.onSettled?.(result, candidate, cause);
		},
		onRevalidated: (result: ResolvedAsset | null, candidate: AssetCandidate, cause?: unknown) => {
			if (signal.aborted) return;
			if (!cause) track(result, candidate);
			options.onRevalidated?.(result, candidate, cause);
		},
	};
	const resolver = createAssetCandidateResolver(options.collections, resolverOptions);
	let lateResolver: ReturnType<typeof createAssetCandidateResolver> | undefined;

	const enqueue = (candidates: AssetCandidate[]) => {
		const fresh = candidates.filter((candidate) => !enqueued.has(candidate.processId));
		if (!fresh.length || signal.aborted) return;
		for (const candidate of fresh) {
			enqueued.add(candidate.processId);
			held.delete(candidate.processId);
		}
		if (!sealed) {
			resolver.enqueue(fresh);
			return;
		}
		// Support that arrives after the crawl drained still resolves, through a
		// resolver nobody awaits, so the finished crawl stays finished.
		lateResolver ??= createAssetCandidateResolver(options.collections, resolverOptions);
		lateResolver.enqueue(fresh);
	};

	const route = (candidates: AssetCandidate[]) => {
		const collections = options.collections();
		const fresh = candidates.filter(
			(candidate) => !enqueued.has(candidate.processId) && !verifying.has(candidate.processId)
		);
		if (!fresh.length) return;
		const { supported, unverified } = partitionAssetCandidateSupport(fresh, collections);
		const routed = new Set([...supported, ...unverified].map((candidate) => candidate.processId));
		for (const candidate of fresh) {
			if (!routed.has(candidate.processId)) held.set(candidate.processId, candidate);
		}
		const toVerify: AssetCandidate[] = [];
		const ready = [...supported];
		for (const candidate of unverified) {
			if (verifiedIds.has(candidate.processId)) ready.push(candidate);
			else if (checkedIds.has(candidate.processId)) held.set(candidate.processId, candidate);
			else toVerify.push(candidate);
		}
		enqueue(ready);
		if (!toVerify.length) return;
		for (const candidate of toVerify) {
			held.delete(candidate.processId);
			verifying.add(candidate.processId);
		}
		supportTail = supportTail.then(async () => {
			try {
				const verification = await verify(toVerify, collections, {
					signal,
					onVerified: (verified) => {
						for (const candidate of verified) verifiedIds.add(candidate.processId);
						enqueue(verified);
					},
				});
				if (verification.unavailable[0]) options.onIndexFailure?.(verification.unavailable[0].error);
			} catch (cause) {
				if (signal.aborted) throw cause;
				options.onIndexFailure?.(cause);
			} finally {
				for (const candidate of toVerify) {
					verifying.delete(candidate.processId);
					checkedIds.add(candidate.processId);
					if (!enqueued.has(candidate.processId)) held.set(candidate.processId, candidate);
				}
			}
		});
		// `finished` awaits the chain; this branch only keeps work queued after an
		// abort from surfacing as an unhandled rejection.
		void supportTail.catch(() => undefined);
	};

	const reclassify = () => {
		const current = [...live.values()];
		if (!current.length) return;
		const computed = new Map(
			current.map((result) => [result.activity.processId, { state: result.state, provider: result.provider }])
		);
		// The stored state is reused: only the collection lookup changed, so no
		// compute request is repeated.
		void resolveAssetCandidates(
			current.map((result) => result.activity),
			options.collections(),
			{
				signal,
				concurrency: 16,
				read: async (processId) => computed.get(processId)!,
				onSettled: (result, candidate, cause) => {
					if (cause || signal.aborted) return;
					const previous = live.get(candidate.processId);
					if (!previous || (result && sameListingPresentation(previous, result))) return;
					track(result, candidate);
					options.onReclassified?.(result, candidate);
				},
			}
		).catch(() => undefined);
	};

	const finished = (async () => {
		try {
			await options.discover(async (candidates) => route(candidates), signal);
		} catch (cause) {
			options.onDiscoveryFailure?.(cause);
		}
		// A support change can append verification work while earlier work drains.
		while (true) {
			const tail = supportTail;
			await tail;
			if (tail === supportTail) break;
		}
		sealed = true;
		await resolver.finish();
		signal.throwIfAborted();
	})();

	return {
		finished,
		supportChanged() {
			if (signal.aborted) return;
			route([...held.values()]);
			reclassify();
		},
	};
}
