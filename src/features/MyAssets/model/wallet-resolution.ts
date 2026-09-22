import type { Collection } from 'api/collections';
import {
	type AssetCandidate,
	createWalletCandidateScan,
	type ResolvedAsset,
	walletAssetGroups,
	type WalletCandidateScan,
} from 'api/discovery';

import { requestFailureKind } from 'helpers/app-error';

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
	error: string | null;
};

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

export function walletResolutionCopy(status: WalletResolutionStatus, failureMessage: string) {
	const milestone = Math.floor(status.resolved / 10) * 10;
	const heading =
		status.phase === 'error'
			? 'Discovery interrupted'
			: !status.discoveryComplete
			? 'Discovering and checking live state'
			: status.phase === 'revalidating'
			? 'Confirming current ownership'
			: status.phase === 'resolving'
			? 'Computing live state'
			: status.phase === 'done' && status.failures
			? status.indexFailures
				? status.failures === status.total
					? 'Candidate checks unavailable'
					: 'Asset checks partially completed'
				: status.failures === status.total
				? 'Live state unavailable'
				: 'Live state partially resolved'
			: status.phase === 'done'
			? 'Live state resolved'
			: 'Resolution interrupted';
	const announcement =
		status.phase === 'error'
			? ''
			: !status.discoveryComplete
			? `Discovering and checking live state. ${status.discovered.toLocaleString()} candidates found${
					milestone ? `, ${milestone.toLocaleString()} checked` : ''
			  }.`
			: status.phase === 'revalidating'
			? `Confirming current ownership. ${(status.revalidated ?? 0).toLocaleString()} of ${(
					status.revalidationTotal ?? 0
			  ).toLocaleString()} visible assets rechecked without cached state.`
			: status.phase === 'resolving'
			? `Checking asset candidates. ${
					status.total ? Math.floor((status.resolved / status.total) * 10) * 10 : 0
			  }% complete.`
			: status.phase === 'done' && status.failures
			? `${failureMessage} ${status.resolved.toLocaleString()} of ${status.total.toLocaleString()} candidate checks completed; ${status.failures.toLocaleString()} unavailable. Resolved assets remain visible.`
			: status.phase === 'done'
			? `Live state resolved for ${status.resolved.toLocaleString()} candidates.`
			: 'Asset resolution was interrupted.';
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
