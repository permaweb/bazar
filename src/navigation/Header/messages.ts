import { defineMessages } from 'helpers/i18n';

export const HEADER_MESSAGES = defineMessages({
	en: {
		collectionDescriptionFungibleTokens:
			'Arweave-native fungible tokens with direct wallet ownership and native $AR settlement.',
		collectionDescriptionArweaveNames: 'Current carrier names owned and traded directly on Arweave.',
		collectionDescriptionPermanent: 'A permanent Arweave collection.',
		headerHome: 'Bazar home',
		headerCreate: 'Create',
		headerCreateAsset: 'Create asset',

		headerSearchLabel: 'Search tokens, collections, and Uniques',
		headerSearchPlaceholder: 'Search tokens, collections, and assets',
		headerSearchDialog: 'Search Bazar',
		headerSearchPanelLabel: 'Search Bazar marketplace',
		headerSearchPanelPlaceholder: 'Search Bazar',
		headerSearchClear: 'Clear',
		headerSearchClearLabel: 'Clear search',
		headerSearchSubmitLabel: 'View search results',
		headerSearchCloseLabel: 'Close search',
		headerSearchCategories: 'Search categories',
		headerSearchScopeAll: 'All',
		headerSearchScopeTokens: 'Tokens',
		headerSearchScopeCollections: 'Collections',
		headerSearchScopeAssets: 'Uniques',
		headerSearchScopeNames: 'Names',

		headerSearchIndexPendingAnnouncement: 'Searching permanent Bazar creation records on Arweave.',
		headerSearchIndexFailedAnnouncement: 'Permanent Bazar creation-record search is temporarily unavailable.',
		headerSearchCollectionsLoadingAnnouncement: 'Loading collection indexes from Arweave.',
		headerSearchUnavailableAnnouncement: 'Marketplace search is unavailable.',
		headerSearchNoMatchesPartial:
			'No loaded tokens, collections, or Uniques match {query}; more token records remain available.',
		headerSearchNoMatches: 'No tokens, collections, or Uniques match {query}.',
		headerSearchSummary: 'Showing {collections} and {assets}.',
		headerSearchSummaryForQuery: 'Showing {collections} and {assets} for {query}.',
		headerSearchSummaryCollections: { one: '{count} collection', other: '{count} collections' },
		headerSearchSummaryAssets: { one: '{count} asset result', other: '{count} asset results' },
		headerSearchRecentCleared: 'Recent searches cleared.',

		headerSearchCollectionsLoading: 'Loading collection indexes from Arweave…',
		headerSearchIndexPending: 'Searching permanent Bazar creation records on Arweave…',
		headerTokenCoverage: 'Token matches cover {loaded} of {discovered} discovered records currently loaded.',
		headerContinueTokenSearch: 'Continue token search',
		headerRecentSearches: 'Recent searches',
		headerRecentSearchesClear: 'Clear',

		headerResultsShown: '{count} shown',
		headerMatchingCollections: 'Matching collections',
		headerFeaturedCollections: 'Featured collections',
		headerMatchingTokens: 'Matching tokens',
		headerTokens: 'Tokens',
		headerMatchingUniques: 'Matching Uniques',
		headerFeaturedUniques: 'Featured Uniques',
		headerTokenMarketContext: 'Fungible token',
		headerTokenTicker: 'Token',
		headerTokenTickerFallback: 'TOKEN',
		headerArtworkUnavailable: 'Artwork unavailable',
		headerAudioArtworkLabel: '{name} {format} audio',
		headerAudioArtworkType: 'Audio',
		headerErrorHeading: 'Unable to load',
		headerErrorRetry: 'Retry',

		// Navigation cannot import a feature, so collection kinds are mapped from their stable code here.
		headerCollectionKindNames: 'Arweave identity',
		headerCollectionKindTokens: 'Fungible token collection',
		headerCollectionKindAssets: 'Permanent artwork collection',
		headerCollectionMeta: '{kind} · {detail}',
		headerCollectionNamesLoaded: '{count} names loaded',
		headerCollectionAssets: { one: '{count} asset', other: '{count} assets' },

		headerDirectProcess: 'Direct process',
		headerDirectProcessNote: 'Live state check required',
		headerCheckTokenProcess: 'Check token process',
		headerCheckTokenProcessDetail: '{id} · support is determined from live state',

		headerNoResults: 'No results for “{query}”',
		headerNoResultsPartialTokens: 'More token records remain available from the token collection.',
		headerNoResultsIndexFailed:
			'Permanent Bazar creation-record search is temporarily unavailable. Try again shortly.',
		headerNoResultsHint:
			'Try the full asset name or process ID. Newly created assets may take time to appear in search.',
	},
});

export type HeaderMessages = (typeof HEADER_MESSAGES)['en'];
