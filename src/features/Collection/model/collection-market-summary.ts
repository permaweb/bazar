import type { Collection } from 'api/collections';

import type { CollectionListingProgress } from './collection-listings';

/** Progress of a listing pass, optionally scoped to the tokens loaded so far. */
export function collectionListingSearchProgress(
	progress: Pick<CollectionListingProgress, 'pages' | 'total' | 'resolved' | 'failures'>,
	loadedTokens: number | null
): string {
	return `${progress.pages.toLocaleString()} index ${
		progress.pages === 1 ? 'check' : 'checks'
	} this pass · ${progress.total.toLocaleString()} ${
		progress.total === 1 ? 'candidate' : 'candidates'
	} · ${progress.resolved.toLocaleString()} checked${
		progress.failures ? ` · ${progress.failures.toLocaleString()} unavailable` : ''
	}${loadedTokens !== null ? ` · among ${loadedTokens.toLocaleString()} loaded tokens` : ''}`;
}

/** The visible count beside the collection tools. */
export function collectionResultSummary(input: {
	collection: Collection;
	loading: boolean;
	listedOnly: boolean;
	listedCount: number;
	offerCount: number;
	query: string;
	initial: string;
	matchCount: number;
	failures: number;
}): string {
	const collection = input.collection;
	const loaded = collection.assets.length;
	if (input.loading) {
		return input.listedOnly
			? `${input.listedCount.toLocaleString()} live ${input.listedCount === 1 ? 'listing' : 'listings'} so far`
			: `${input.offerCount.toLocaleString()} live ${input.offerCount === 1 ? 'offer' : 'offers'} so far`;
	}
	if (input.query) {
		return `${input.matchCount.toLocaleString()} ${
			collection.kind === 'names' ? 'current namespace' : 'loaded'
		} matches`;
	}
	if (input.initial !== 'all')
		return `${input.matchCount.toLocaleString()} loaded names beginning with ${input.initial}`;
	if (input.listedOnly) {
		return `${input.matchCount.toLocaleString()} live ${input.matchCount === 1 ? 'listing' : 'listings'}${
			collection.kind === 'tokens' && collection.hasMore ? ' in loaded tokens' : ''
		}${input.failures ? ` · ${input.failures.toLocaleString()} unavailable` : ''}`;
	}
	if (collection.kind === 'names') {
		return collection.hasMore
			? `${loaded.toLocaleString()} current names loaded · more available`
			: `${loaded.toLocaleString()} current ${loaded === 1 ? 'name' : 'names'}`;
	}
	if (collection.kind === 'tokens' && collection.hasMore)
		return `${loaded.toLocaleString()} tokens loaded · more available`;
	return `${loaded.toLocaleString()} ${
		collection.kind === 'tokens' ? (loaded === 1 ? 'token' : 'tokens') : loaded === 1 ? 'asset' : 'assets'
	}`;
}

/** The polite announcement for the current search, price check, or listing pass. */
export function collectionResultAnnouncement(input: {
	collection: Collection;
	loading: boolean;
	listedOnly: boolean;
	searchProgress: string;
	pricesLoading: boolean;
	visiblePriceCount: number;
	query: string;
	matchCount: number;
	summary: string;
}): string {
	const collection = input.collection;
	if (input.loading) {
		return input.listedOnly
			? `Searching Arweave for live listings in ${collection.name}: ${input.searchProgress}.`
			: `Checking live offers in ${collection.name} while all items remain visible.`;
	}
	if (input.pricesLoading) {
		return `Checking live prices for ${input.visiblePriceCount.toLocaleString()} visible assets in ${
			collection.name
		}.`;
	}
	if (input.query) {
		if (input.matchCount) {
			return `${input.matchCount.toLocaleString()} ${collection.kind === 'names' ? 'names' : 'assets'} match ${
				input.query
			} in ${collection.name}.`;
		}
		return collection.kind === 'tokens' && collection.hasMore
			? `No loaded tokens match ${input.query} in ${collection.name}; more token records remain available.`
			: `No ${collection.kind === 'names' ? 'names' : 'assets'} match ${input.query} in ${collection.name}.`;
	}
	return `${input.summary} in ${collection.name}.`;
}
