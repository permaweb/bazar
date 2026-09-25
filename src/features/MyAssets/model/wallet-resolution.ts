import type { Collection } from 'api/collections';
import {
	type AssetCandidate,
	createWalletCandidateScan,
	type ResolvedAsset,
	walletAssetGroups,
	type WalletCandidateScan,
} from 'api/discovery';

import {
	type AppError,
	appError,
	type AppErrorMessages,
	requestFailureKind,
	requestFailureMessage,
} from 'helpers/app-error';
import { formatMessage } from 'helpers/i18n';

import type { MyAssetsMessages } from '../messages';

export type CandidateSupportFailure = { candidate: AssetCandidate; error: unknown };

export type WalletResolutionStatus = {
	phase: 'discovering' | 'resolving' | 'revalidating' | 'done' | 'error';
	discoveryComplete: boolean;
	discovered: number;
	resolved: number;
	total: number;
	failures: number;
	indexFailures: number;
	rateLimited: number;
	indexRateLimited: number;
	revalidated?: number;
	revalidationTotal?: number;
	error: AppError | null;
};

/** How one candidate check ended; rate limiting is counted separately so the retry copy can explain it. */
export type CandidateCheckOutcome = 'resolved' | 'unavailable' | 'rate-limited';

/**
 * Transitions of one wallet discovery session. Counts are adjusted as candidates are found, screened, reopened by
 * newer activity, resolved against live state, and retried; every decrement is clamped at zero.
 */
export type WalletResolutionEvent =
	/** A new discovery scope or explicit refresh starts from nothing. */
	| { type: 'reset' }
	/** The same scope resumes discovery after a remount or retry. */
	| { type: 'resumed' }
	/** A cached state was shown while a zero-age read confirms it. */
	| { type: 'revalidation-scheduled' }
	| { type: 'candidate-settled'; outcome: CandidateCheckOutcome }
	| { type: 'candidate-revalidated'; outcome: CandidateCheckOutcome }
	/** Settled candidates reopened by newer activity, with the failures they no longer count. */
	| {
			type: 'candidates-reopened';
			reopened: number;
			failures: number;
			indexFailures: number;
			rateLimited: number;
			indexRateLimited: number;
	  }
	/** A discovered page was screened; `counted` candidates are new and `resolving` is true when any need checks. */
	| { type: 'page-screened'; discovered: number; counted: number; resolving: boolean }
	/** Support checks settled `checked` candidates without compute; `unavailable` of them failed. */
	| { type: 'support-checked'; checked: number; unavailable: number; rateLimited: number }
	| { type: 'revalidating' }
	| { type: 'completed'; discovered: number }
	| { type: 'failed'; error: AppError }
	/** A retry of unavailable candidates reopens their counts. */
	| {
			type: 'retry-started';
			retried: number;
			retriedIndex: number;
			retriedRateLimited: number;
			retriedIndexRateLimited: number;
	  }
	/** A retry finished; the remaining failure sets are authoritative. */
	| {
			type: 'retry-completed';
			failures: number;
			indexFailures: number;
			rateLimited: number;
			indexRateLimited: number;
	  };

export function candidateCheckOutcome(error?: unknown): CandidateCheckOutcome {
	if (!error) return 'resolved';
	return requestFailureKind(error) === 'rate-limited' ? 'rate-limited' : 'unavailable';
}

export function walletResolutionReducer(
	status: WalletResolutionStatus,
	event: WalletResolutionEvent
): WalletResolutionStatus {
	switch (event.type) {
		case 'reset':
			return initialWalletResolutionStatus();
		case 'resumed':
			return { ...status, phase: 'discovering', error: null };
		case 'revalidation-scheduled':
			return { ...status, revalidationTotal: (status.revalidationTotal ?? 0) + 1 };
		case 'candidate-settled':
			return {
				...status,
				resolved: status.resolved + 1,
				failures: status.failures + (event.outcome === 'resolved' ? 0 : 1),
				rateLimited: status.rateLimited + (event.outcome === 'rate-limited' ? 1 : 0),
			};
		case 'candidate-revalidated':
			return {
				...status,
				revalidated: (status.revalidated ?? 0) + 1,
				failures: status.failures + (event.outcome === 'resolved' ? 0 : 1),
				rateLimited: status.rateLimited + (event.outcome === 'rate-limited' ? 1 : 0),
			};
		case 'candidates-reopened':
			return {
				...status,
				resolved: Math.max(0, status.resolved - event.reopened),
				failures: Math.max(0, status.failures - event.failures),
				indexFailures: Math.max(0, status.indexFailures - event.indexFailures),
				rateLimited: Math.max(0, status.rateLimited - event.rateLimited),
				indexRateLimited: Math.max(0, status.indexRateLimited - event.indexRateLimited),
			};
		case 'page-screened':
			return {
				...status,
				phase: event.resolving ? 'resolving' : status.phase,
				discovered: event.discovered,
				total: status.total + event.counted,
			};
		case 'support-checked':
			return {
				...status,
				resolved: status.resolved + event.checked,
				failures: status.failures + event.unavailable,
				indexFailures: status.indexFailures + event.unavailable,
				rateLimited: status.rateLimited + event.rateLimited,
				indexRateLimited: status.indexRateLimited + event.rateLimited,
			};
		case 'revalidating':
			return { ...status, phase: 'revalidating', discoveryComplete: true };
		case 'completed':
			return {
				...status,
				phase: 'done',
				discoveryComplete: true,
				discovered: event.discovered,
				revalidated: undefined,
				revalidationTotal: undefined,
			};
		case 'failed':
			return { ...status, phase: 'error', error: event.error };
		case 'retry-started':
			return {
				...status,
				phase: 'resolving',
				discoveryComplete: true,
				resolved: Math.max(0, status.resolved - event.retried),
				failures: Math.max(0, status.failures - event.retried),
				indexFailures: Math.max(0, status.indexFailures - event.retriedIndex),
				rateLimited: Math.max(0, status.rateLimited - event.retriedRateLimited - event.retriedIndexRateLimited),
				indexRateLimited: Math.max(0, status.indexRateLimited - event.retriedIndexRateLimited),
				error: null,
			};
		case 'retry-completed':
			return {
				...status,
				phase: 'done',
				failures: event.failures,
				indexFailures: event.indexFailures,
				rateLimited: event.rateLimited,
				indexRateLimited: event.indexRateLimited,
			};
	}
}

/** A failed discovery pass is reported as a transaction-index failure, keeping its rate-limit classification. */
export function walletDiscoveryError(cause: unknown): AppError {
	return appError(requestFailureKind(cause) === 'rate-limited' ? 'index-rate-limited' : 'index-unavailable', {
		cause,
	});
}

export function walletResolutionIsWorking(status: WalletResolutionStatus) {
	return status.phase === 'discovering' || status.phase === 'resolving' || status.phase === 'revalidating';
}

/** Explains which service (the transaction index, AO compute, or both) left candidates unavailable. */
export function walletResolutionFailureMessage(
	status: WalletResolutionStatus,
	errorMessages: AppErrorMessages
): string {
	const computeRateLimited = status.rateLimited - status.indexRateLimited;
	const computeFailures = status.failures - status.indexFailures;
	return [
		status.indexFailures
			? requestFailureMessage(errorMessages, 'index', status.indexRateLimited ? 'rate-limited' : 'unavailable')
			: '',
		computeFailures
			? requestFailureMessage(errorMessages, 'compute', computeRateLimited ? 'rate-limited' : 'unavailable')
			: '',
	]
		.filter(Boolean)
		.join(' ');
}

export function refreshCandidateRetryMetadata(
	candidate: AssetCandidate,
	computeFailures: Map<string, AssetCandidate>,
	supportFailures: Map<string, CandidateSupportFailure>
) {
	if (computeFailures.has(candidate.processId)) computeFailures.set(candidate.processId, candidate);
	const supportFailure = supportFailures.get(candidate.processId);
	if (supportFailure) supportFailures.set(candidate.processId, { ...supportFailure, candidate });
}

export function trackRateLimitFailure(rateLimits: Set<string>, processId: string, error?: unknown) {
	if (error && requestFailureKind(error) === 'rate-limited') rateLimits.add(processId);
	else rateLimits.delete(processId);
}

export function walletResolutionCopy(
	status: WalletResolutionStatus,
	failureMessage: string,
	language: MyAssetsMessages
) {
	const milestone = Math.floor(status.resolved / 10) * 10;
	const heading =
		status.phase === 'error'
			? language.myAssetsResolutionDiscoveryInterrupted
			: !status.discoveryComplete
			? language.myAssetsResolutionDiscovering
			: status.phase === 'revalidating'
			? language.myAssetsResolutionConfirmingOwnership
			: status.phase === 'resolving'
			? language.myAssetsResolutionComputing
			: status.phase === 'done' && status.failures
			? status.indexFailures
				? status.failures === status.total
					? language.myAssetsResolutionCandidateChecksUnavailable
					: language.myAssetsResolutionChecksPartiallyCompleted
				: status.failures === status.total
				? language.myAssetsResolutionLiveStateUnavailable
				: language.myAssetsResolutionLiveStatePartiallyResolved
			: status.phase === 'done'
			? language.myAssetsResolutionLiveStateResolved
			: language.myAssetsResolutionInterrupted;
	const announcement =
		status.phase === 'error'
			? ''
			: !status.discoveryComplete
			? formatMessage(
					milestone
						? language.myAssetsAnnouncementDiscoveringChecked
						: language.myAssetsAnnouncementDiscovering,
					{ discovered: status.discovered.toLocaleString(), checked: milestone.toLocaleString() }
			  )
			: status.phase === 'revalidating'
			? formatMessage(language.myAssetsAnnouncementConfirmingOwnership, {
					revalidated: (status.revalidated ?? 0).toLocaleString(),
					total: (status.revalidationTotal ?? 0).toLocaleString(),
			  })
			: status.phase === 'resolving'
			? formatMessage(language.myAssetsAnnouncementCheckingCandidates, {
					percent: status.total ? Math.floor((status.resolved / status.total) * 10) * 10 : 0,
			  })
			: status.phase === 'done' && status.failures
			? formatMessage(language.myAssetsAnnouncementPartiallyResolved, {
					failureMessage,
					resolved: status.resolved.toLocaleString(),
					total: status.total.toLocaleString(),
					failures: status.failures.toLocaleString(),
			  })
			: status.phase === 'done'
			? formatMessage(language.myAssetsAnnouncementResolved, { resolved: status.resolved.toLocaleString() })
			: language.myAssetsAnnouncementInterrupted;
	return { heading, announcement };
}

export function walletResolutionIsDeterminate(status: WalletResolutionStatus) {
	return status.discoveryComplete;
}

export function walletResolutionShowsProgress(status: WalletResolutionStatus) {
	return status.phase !== 'error';
}

export type WalletAnnouncementProgress = { scope: string; discovered: number; revalidated: number };

export function nextWalletAnnouncementProgress(
	previous: WalletAnnouncementProgress,
	status: WalletResolutionStatus,
	scope: string
): WalletAnnouncementProgress {
	const reset = previous.scope !== scope || status.discovered < previous.discovered;
	const baseline = reset ? { scope, discovered: 0, revalidated: 0 } : previous;
	const revalidated = status.revalidated ?? 0;
	const revalidationTotal = status.revalidationTotal ?? 0;
	const announcedRevalidated =
		status.phase === 'revalidating' && revalidationTotal
			? revalidated >= revalidationTotal
				? revalidationTotal
				: Math.floor((revalidated / revalidationTotal) * 10) >
				  Math.floor((baseline.revalidated / revalidationTotal) * 10)
				? Math.floor((Math.floor((revalidated / revalidationTotal) * 10) * revalidationTotal) / 10)
				: baseline.revalidated
			: revalidated;
	if (status.discoveryComplete || status.phase === 'error' || status.discovered === 0) {
		return { scope, discovered: status.discovered, revalidated: announcedRevalidated };
	}
	if (baseline.discovered === 0) return { scope, discovered: status.discovered, revalidated: announcedRevalidated };
	return {
		scope,
		discovered: Math.max(baseline.discovered, Math.floor(status.discovered / 500) * 500),
		revalidated: announcedRevalidated,
	};
}

export function groupWalletResults(results: ResolvedAsset[], address: string) {
	const owned: ResolvedAsset[] = [];
	const listed: ResolvedAsset[] = [];
	for (const result of results) {
		const groups = walletAssetGroups(result, address);
		if (groups.includes('owned')) owned.push(result);
		if (groups.includes('listed')) listed.push(result);
	}
	return { owned, listed };
}

export type WalletDiscoverySession = {
	scope: string;
	scan: WalletCandidateScan;
	counted: Set<string>;
	screened: Set<string>;
	completed: Set<string>;
	latestCandidates: Map<string, AssetCandidate>;
	resolvedAssets: Map<string, ResolvedAsset>;
	complete: boolean;
};

export function walletDiscoveryScope(address: string, gateway: string, collections: Collection[]) {
	const supportedCollections = collections
		.map((collection) =>
			[
				collection.id,
				collection.kind,
				collection.kind === 'names'
					? collection.namespace?.manifestId ?? ''
					: collection.manifestId ?? collection.id,
			].join(':')
		)
		.sort();
	return [address, gateway, ...supportedCollections].join('|');
}

export function walletDiscoverySession(
	current: WalletDiscoverySession | undefined,
	scope: string,
	address: string,
	scan = createWalletCandidateScan(address)
): WalletDiscoverySession {
	if (current?.scope === scope) return current;
	return {
		scope,
		scan,
		counted: new Set<string>(),
		screened: new Set<string>(),
		completed: new Set<string>(),
		latestCandidates: new Map(scan.found),
		resolvedAssets: new Map<string, ResolvedAsset>(),
		complete: false,
	};
}

export function walletDiscoverySessionIsCurrent(
	session: WalletDiscoverySession | undefined,
	scope: string
): session is WalletDiscoverySession {
	return Boolean(scope && session?.scope === scope);
}

export function updateWalletResolvedAsset(
	session: WalletDiscoverySession,
	result: ResolvedAsset | null,
	candidate: AssetCandidate,
	address: string
) {
	if (result && walletAssetGroups(result, address).length) {
		session.resolvedAssets.set(result.asset.id, {
			...result,
			activity: session.latestCandidates.get(result.asset.id) ?? candidate,
		});
		return true;
	}
	return session.resolvedAssets.delete(candidate.processId);
}

export function reopenWalletCandidate(session: WalletDiscoverySession, candidate: AssetCandidate) {
	const previous = session.latestCandidates.get(candidate.processId);
	const newer = Boolean(
		previous &&
			(candidate.height > previous.height ||
				(candidate.height === previous.height && candidate.timestamp > previous.timestamp) ||
				(candidate.height === previous.height &&
					candidate.timestamp === previous.timestamp &&
					(candidate.activityIds ?? []).some((id) => !(previous.activityIds ?? []).includes(id))))
	);
	if (!newer || !session.screened.delete(candidate.processId)) {
		return { reopened: false, completed: false, removedResult: false };
	}
	return {
		reopened: true,
		completed: session.completed.delete(candidate.processId),
		removedResult: session.resolvedAssets.delete(candidate.processId),
	};
}

export function initialWalletResolutionStatus(): WalletResolutionStatus {
	return {
		phase: 'discovering',
		discoveryComplete: false,
		discovered: 0,
		resolved: 0,
		total: 0,
		failures: 0,
		indexFailures: 0,
		rateLimited: 0,
		indexRateLimited: 0,
		error: null,
	};
}
