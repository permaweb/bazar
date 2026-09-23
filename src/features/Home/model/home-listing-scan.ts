import type { HomeListingShell } from 'api/collections';
import { isLiveListing, type ResolvedAsset } from 'api/discovery';
import type { AssetState } from 'api/marketplace';

import type { HomeMarketSummary } from './home-market';

export type HomeListingFailure = Extract<HomeMarketSummary, { status: 'unavailable' }>;

// One resolved listing candidate, or a background revalidation of an already published listing.
export type HomeListingPublication =
	| { processId: string; result: ResolvedAsset | null }
	| { processId: string; state: AssetState; provider: string; refresh: true };

export type HomeListingScanStatus =
	| { status: 'idle' }
	| { status: 'scanning' }
	| { status: 'complete' }
	| { status: 'failed'; failure: HomeListingFailure };

/**
 * The marketplace-wide live listing scan behind Discover.
 *
 * `cached` holds session-snapshot shells until the scan settles their assets; `listings` holds live listings resolved
 * by the current scan. `run` names the scan whose publications may still apply: results from any other run are
 * ignored, so a superseded or stopped scan can never overwrite newer state.
 */
export type HomeListingScanState = {
	run: number | null;
	status: HomeListingScanStatus;
	cached: HomeListingShell[];
	listings: ResolvedAsset[];
};

export type HomeListingScanEvent =
	| { type: 'snapshot-restored'; cached: HomeListingShell[] }
	| { type: 'started'; run: number }
	| { type: 'published'; run: number; batch: HomeListingPublication[] }
	| { type: 'finished'; run: number; failure?: HomeListingFailure }
	| { type: 'blocked'; failure: HomeListingFailure }
	| { type: 'stopped' };

export function initialHomeListingScan(cached: HomeListingShell[] = []): HomeListingScanState {
	return { run: null, status: { status: 'idle' }, cached, listings: [] };
}

export function homeListingScanReducer(state: HomeListingScanState, event: HomeListingScanEvent): HomeListingScanState {
	switch (event.type) {
		case 'snapshot-restored':
			return { ...state, cached: event.cached };
		case 'started':
			return { ...state, run: event.run, status: { status: 'scanning' } };
		case 'published':
			if (event.run !== state.run) return state;
			return {
				...state,
				cached: settleCachedListings(state.cached, event.batch),
				listings: mergeHomeListingPublications(state.listings, event.batch),
			};
		case 'finished':
			if (event.run !== state.run || state.status.status !== 'scanning') return state;
			return {
				...state,
				status: event.failure ? { status: 'failed', failure: event.failure } : { status: 'complete' },
			};
		case 'blocked':
			return { ...state, run: null, status: { status: 'failed', failure: event.failure } };
		case 'stopped':
			return {
				...state,
				run: null,
				status: state.status.status === 'scanning' ? { status: 'idle' } : state.status,
			};
	}
}

export function homeListingScanFailure(state: HomeListingScanState) {
	return state.status.status === 'failed' ? state.status.failure : undefined;
}

// Settled assets leave the session snapshot; the live result, listed or not, is now authoritative.
function settleCachedListings(cached: HomeListingShell[], batch: HomeListingPublication[]) {
	const settledIds = new Set(batch.map((publication) => publication.processId));
	return cached.filter((listing) => !settledIds.has(listing.asset.id));
}

export function mergeHomeListingPublications(current: ResolvedAsset[], batch: HomeListingPublication[]) {
	const results = new Map(current.map((result) => [result.asset.id, result]));
	for (const publication of batch) {
		if ('refresh' in publication) {
			const previous = results.get(publication.processId);
			if (previous) {
				const updated = { ...previous, state: publication.state, provider: publication.provider };
				if (isLiveListing(updated)) results.set(publication.processId, updated);
				else results.delete(publication.processId);
			}
		} else {
			results.delete(publication.processId);
			if (publication.result && isLiveListing(publication.result)) {
				results.set(publication.processId, publication.result);
			}
		}
	}
	return [...results.values()];
}
