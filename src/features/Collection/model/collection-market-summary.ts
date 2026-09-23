import type { Collection } from 'api/collections';

import { formatMessage } from 'helpers/i18n';

import type { CollectionMessages, CollectionPlural } from '../messages';

import type { CollectionListingProgress } from './collection-listings';

/** Progress of a listing pass, optionally scoped to the tokens loaded so far. */
export function collectionListingSearchProgress(
	progress: Pick<CollectionListingProgress, 'pages' | 'total' | 'resolved' | 'failures'>,
	loadedTokens: number | null,
	messages: CollectionMessages,
	plural: CollectionPlural
): string {
	const segments = [
		plural(messages.listingProgressChecks, progress.pages, { count: progress.pages.toLocaleString() }),
		plural(messages.listingProgressCandidates, progress.total, { count: progress.total.toLocaleString() }),
		formatMessage(messages.listingProgressChecked, { count: progress.resolved.toLocaleString() }),
	];
	if (progress.failures) {
		segments.push(
			formatMessage(messages.listingProgressUnavailable, { count: progress.failures.toLocaleString() })
		);
	}
	if (loadedTokens !== null) {
		segments.push(formatMessage(messages.listingProgressLoadedTokens, { count: loadedTokens.toLocaleString() }));
	}
	return segments.join(messages.progressSeparator);
}

/** The visible count beside the collection tools. */
export function collectionResultSummary(
	input: {
		collection: Collection;
		loading: boolean;
		listedOnly: boolean;
		listedCount: number;
		offerCount: number;
		query: string;
		initial: string;
		matchCount: number;
		failures: number;
	},
	messages: CollectionMessages,
	plural: CollectionPlural
): string {
	const collection = input.collection;
	const loaded = collection.assets.length;
	if (input.loading) {
		return input.listedOnly
			? plural(messages.summaryListingsSoFar, input.listedCount, { count: input.listedCount.toLocaleString() })
			: plural(messages.summaryOffersSoFar, input.offerCount, { count: input.offerCount.toLocaleString() });
	}
	if (input.query) {
		return formatMessage(
			collection.kind === 'names' ? messages.summaryNamespaceMatches : messages.summaryLoadedMatches,
			{ count: input.matchCount.toLocaleString() }
		);
	}
	if (input.initial !== 'all') {
		return formatMessage(messages.summaryInitialMatches, {
			count: input.matchCount.toLocaleString(),
			initial: input.initial,
		});
	}
	if (input.listedOnly) {
		const listings = plural(
			collection.kind === 'tokens' && collection.hasMore
				? messages.summaryLiveListingsInLoadedTokens
				: messages.summaryLiveListings,
			input.matchCount,
			{ count: input.matchCount.toLocaleString() }
		);
		return input.failures
			? [
					listings,
					formatMessage(messages.listingProgressUnavailable, { count: input.failures.toLocaleString() }),
			  ].join(messages.progressSeparator)
			: listings;
	}
	if (collection.kind === 'names') {
		return collection.hasMore
			? formatMessage(messages.summaryNamesLoadedMore, { count: loaded.toLocaleString() })
			: plural(messages.summaryNames, loaded, { count: loaded.toLocaleString() });
	}
	if (collection.kind === 'tokens' && collection.hasMore)
		return formatMessage(messages.summaryTokensLoadedMore, { count: loaded.toLocaleString() });
	return plural(collection.kind === 'tokens' ? messages.summaryTokens : messages.summaryAssets, loaded, {
		count: loaded.toLocaleString(),
	});
}

/** The polite announcement for the current search, price check, or listing pass. */
export function collectionResultAnnouncement(
	input: {
		collection: Collection;
		loading: boolean;
		listedOnly: boolean;
		searchProgress: string;
		pricesLoading: boolean;
		visiblePriceCount: number;
		query: string;
		matchCount: number;
		summary: string;
	},
	messages: CollectionMessages
): string {
	const collection = input.collection;
	if (input.loading) {
		return input.listedOnly
			? formatMessage(messages.announcementSearchingListings, {
					collection: collection.name,
					progress: input.searchProgress,
			  })
			: formatMessage(messages.announcementCheckingOffers, { collection: collection.name });
	}
	if (input.pricesLoading) {
		return formatMessage(messages.announcementCheckingPrices, {
			collection: collection.name,
			count: input.visiblePriceCount.toLocaleString(),
		});
	}
	if (input.query) {
		if (input.matchCount) {
			return formatMessage(
				collection.kind === 'names' ? messages.announcementNamesMatch : messages.announcementAssetsMatch,
				{ collection: collection.name, count: input.matchCount.toLocaleString(), query: input.query }
			);
		}
		const empty =
			collection.kind === 'tokens' && collection.hasMore
				? messages.announcementNoLoadedTokensMatch
				: collection.kind === 'names'
				? messages.announcementNoNamesMatch
				: messages.announcementNoAssetsMatch;
		return formatMessage(empty, { collection: collection.name, query: input.query });
	}
	return formatMessage(messages.announcementSummary, { collection: collection.name, summary: input.summary });
}
