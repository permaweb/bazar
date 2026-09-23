import { defineMessages, type MessageValues, type PluralMessage } from 'helpers/i18n';

export const COLLECTION_MESSAGES = defineMessages({
	en: {
		// Collection identity, mapped from the adapter's `kind` code rather than adapter-provided English.
		collectionTokensName: 'Tokens',
		collectionEyebrowNames: 'Carrier assets',
		collectionEyebrowTokens: 'Fungible tokens',
		collectionEyebrowImages: 'Permanent artwork',

		// Route states
		collectionRouteTitle: 'Collection',
		collectionUnavailableTitle: 'Collection unavailable',
		collectionNotFoundTitle: 'Collection not found',
		collectionNotFoundDetail: 'This collection could not be found on Arweave.',
		collectionActivityRouteTitle: 'Collection activity',
		activityUnavailableTitle: 'Activity unavailable',
		readingCollectionIndex: 'Reading collection index…',
		backAllCollections: 'All collections',
		backDiscover: 'Discover',

		// Compiled-fallback index notice
		indexNoticeChecking: 'Checking compute. This page remains available while the check finishes.',
		indexNoticeCheckingCompact: 'Checking compute…',
		computeIncompleteNotice: 'Compute hasn’t completed yet. Please try again.',
		retry: 'Retry',
		collectionErrorHeading: 'Unable to load',
		collectionRouteEyebrow: 'Arweave marketplace',
		collectionArtworkUnavailable: 'Artwork unavailable',
		collectionTokenTickerFallback: 'TOKEN',

		// Tabs
		tabsLabel: '{name} views',
		tabTokens: 'Tokens',
		tabItems: 'Items',
		tabOffers: 'Offers',
		tabActivity: 'Activity',

		// Summary header and stats
		collectionSummaryLabel: 'Collection summary',
		statFloorPrice: 'Floor price',
		statLiveOffers: 'Live offers',
		statLoadedSupply: 'Loaded / supply',
		statOfferCandidates: 'Offer candidates',
		statIndexedEvents: 'Indexed events',
		statBatchesChecked: 'Batches checked',
		statActivityStatus: 'Activity status',
		statChecking: 'Checking…',
		loadedSupplyValue: '{loaded} / {total}',
		indexedEventsSoFar: '{count} so far',
		activityStatusNeedsRetry: 'Needs retry',
		activityStatusRefreshing: 'Refreshing',
		activityStatusCurrent: 'Current',

		// Description
		collectionDescriptionFungibleTokens:
			'Arweave-native fungible tokens with direct wallet ownership and native $AR settlement.',
		collectionDescriptionArweaveNames: 'Current carrier names owned and traded directly on Arweave.',
		collectionDescriptionPermanent: 'A permanent Arweave collection.',
		descriptionShowMore: 'Show more',
		descriptionShowLess: 'Show less',

		// Alphabet filter
		alphabetFilterLabel: 'Filter names by first letter',
		alphabetAllNamesLabel: 'All names',
		alphabetLetterLabel: 'Names beginning with {letter}',
		alphabetAll: 'All',
		alphabetBrowsePrevious: 'Browse earlier letters',
		alphabetBrowseNext: 'Browse later letters',

		// Tools
		compactTokenCount: '1 token',
		assetLayoutLabel: 'Asset layout',
		viewComfortable: 'Comfortable grid',
		viewCompact: 'Compact grid',
		viewList: 'List view',
		searchCollection: 'Search {name}',
		searchPlaceholder: 'Search items',
		sortLabel: 'Sort',
		sortRecent: 'Recently active',
		sortPriceLow: 'Price: Low to High',
		sortPriceHigh: 'Price: High to Low',
		sortName: 'Name: A to Z',
		showLabel: 'Show',
		showAllAssets: 'All assets',
		showListedForSale: 'Listed for sale',

		// Asset results
		tokenResultsLabel: '{name} tokens',
		assetResultsLabel: '{name} assets',
		forSaleBadge: 'For sale',
		tokenProcessContext: 'Process · {id}',
		unitPriceLabel: 'Unit price',
		priceUnavailable: 'Unavailable',
		priceUnlisted: 'Unlisted',
		priceNotListed: 'Not listed',
		priceChecking: 'Checking…',

		// Listing and price notices
		checkingLiveListings: 'Checking live listings',
		searchingArweaveForLiveListings: 'Searching Arweave for live listings',
		pricesUnavailableNotice: {
			one: 'Compute hasn’t completed yet. Please try again. {count} visible price remains unavailable.',
			other: 'Compute hasn’t completed yet. Please try again. {count} visible prices remain unavailable.',
		},
		listingsUnavailableNotice: {
			one: 'Compute hasn’t completed yet. Please try again. {count} listing candidate remains unavailable. Resolved listings remain visible.',
			other: 'Compute hasn’t completed yet. Please try again. {count} listing candidates remain unavailable. Resolved listings remain visible.',
		},
		listingsRecheckingNotice: {
			one: 'Rechecking only the listing candidates that were unavailable. {count} listing candidate remains unavailable. Resolved listings remain visible.',
			other: 'Rechecking only the listing candidates that were unavailable. {count} listing candidates remain unavailable. Resolved listings remain visible.',
		},
		pagedTokenScopeNotice:
			'Browsing {loaded} of {total} discovered tokens. Prices, listings, and recent activity cover the loaded records.',

		// Empty states
		listingsEmptyQueryTitle: 'No live listings match “{query}”',
		listingsEmptyInitialTitle: 'No live listings begin with {initial}',
		listingsEmptyFailuresTitle: 'No live listings yet',
		listingsEmptyLoadedTokensTitle: 'No live listings in loaded tokens',
		listingsEmptyTitle: 'No live listings found',
		clearFilters: 'Clear filters',
		listingsEmptyFilteredDetail: 'Clear the current filters to see every live listing.',
		listingsEmptyFailuresDetail:
			'Some candidates could not be checked through the configured AO peers. Retry them before treating this as an empty market.',
		listingsEmptyLoadedTokensDetail:
			'Every offer candidate among the {count} loaded tokens was checked against current process state. Load more tokens to extend this market view.',
		listingsEmptyCandidatesDetail:
			'Every indexed offer candidate was checked against current process state through {gateway}; none remains live.',
		listingsEmptyDetail:
			'Arweave returned no indexed offer candidates for this collection window. Live state remains the marketplace truth once a candidate is found.',
		assetsEmptyLoadedTokensQueryTitle: 'No loaded tokens match “{query}”',
		assetsEmptyQueryTitle: 'No assets match “{query}”',
		assetsEmptyInitialTitle: 'No names beginning with {initial}',
		assetsEmptyTitle: 'Nothing here yet',
		assetsEmptyLoadedTokensQueryDetail: 'Search the next token records or clear the current query.',
		assetsEmptyQueryDetail: 'Try a shorter search or clear the current query.',
		assetsEmptyInitialDetail: 'Try another letter or return to all names.',
		assetsEmptyDetail: 'This collection does not contain any indexed assets yet.',
		viewAllNames: 'View all names',
		clearSearch: 'Clear search',

		// Analytics panels
		analyticsLabel: 'Collection analytics',
		activityAnalyticsLabel: 'Activity analytics',
		analyticsEyebrow: 'Market',
		analyticsHeading: 'Analytics',
		analyticsLiveOffersTab: 'Live offers',
		analyticsActivityTab: 'Activity',
		analyticsIndexedEvents: 'Indexed events',
		analyticsBatchesChecked: 'Batches checked',
		analyticsSource: 'Source',
		analyticsSourceArweaveIndex: 'Arweave index',
		analyticsStatus: 'Status',
		checkingLiveOffers: 'Checking live offers',
		checkingLiveOffersDetail: 'Reading current asset state through the selected AO transport.',
		refreshingLiveOffers: 'Refreshing live offer depth. Resolved offers remain visible.',
		orderbookPrice: 'Price',
		orderbookQuantity: 'Quantity',
		orderbookTotal: 'Total',
		orderbookLiveOffers: 'Live offers',
		orderbookCumulativeDepth: '{percent}% cumulative depth',
		noLiveOffersTitle: 'No live offers found',
		noLiveOffersDetail: 'No indexed offer currently survives live process-state verification.',

		// Append dialog
		appendOpen: 'Add assets',
		appendClose: 'Close add assets',
		appendEyebrow: 'Extend collection',
		appendTitle: 'Add assets to {name}',
		appendIntro:
			'Each image becomes a wallet-owned Arweave asset. A new immutable manifest then updates the collection carrier.',
		appendFilesReady: '{count} images ready',
		appendChooseImages: 'Choose images',
		appendFileHint: 'PNG, JPEG, WebP, or GIF · up to 10 files',
		appendSelectedImages: 'Selected images',
		appendEstimating: 'Checking Arweave storage cost…',
		appendReady: 'Ready',
		appendEstimateValue: '{amount} AR · {transactions} transactions',
		appendSubmitting: 'Adding assets…',
		appendSubmit: 'Add {count} assets',
		appendUploadName: '{name} additions',
		appendUploadStatus: 'Preparing secure wallet approvals…',
		appendPhaseAssetSigning: 'Asset {index} of {total} · Approve in your wallet',
		appendPhaseAssetUploading: 'Asset {index} of {total} · Uploading to Arweave',
		appendPhaseManifestSigning: 'Approve the new manifest',
		appendPhaseManifestPublishing: 'Publishing manifest',
		appendPhaseCarrierSigning: 'Approve the collection update',
		appendPhaseCarrierUpdating: 'Updating collection carrier',

		// Progressive reveal of the asset grid
		allLoadedNamesShown: 'All {count} currently loaded names are shown.',
		allLoadedAssetsShown: 'All {count} currently loaded assets are shown.',
		allNamesShown: 'All {count} names are shown.',
		allAssetsShown: 'All {count} assets are shown.',
		showingNames: 'Showing {shown} of {total} names.',
		showingAssets: 'Showing {shown} of {total} assets.',
		showMoreNames: 'Show {count} more names',
		showMoreAssets: 'Show {count} more assets',

		// Loading further index records
		moreTokensLoaded: { one: '{count} more token loaded.', other: '{count} more tokens loaded.' },
		moreNamesLoaded: { one: '{count} more current name loaded.', other: '{count} more current names loaded.' },
		noMoreTokensRemaining: 'No additional tokens were found in that page. More token records remain.',
		noMoreTokensComplete: 'No additional tokens were found in that page. The token index is now fully checked.',
		noMoreNamesRemaining: 'No additional current names were found in that page. More carrier records remain.',
		noMoreNamesComplete:
			'No additional current names were found in that page. The carrier index is now fully checked.',
		searchingTokenRecords: 'Searching token records…',
		checkingTokenRecords: 'Checking token records…',
		checkingCarrierRecords: 'Checking carrier records…',
		searchNextTokenRecords: 'Search next 100 token records',
		checkNextTokenRecords: 'Check next 100 token records',
		checkNextCarrierRecords: 'Check next 100 carrier records',

		// Result summary beside the tools
		progressSeparator: ' · ',
		listingProgressChecks: { one: '{count} index check this pass', other: '{count} index checks this pass' },
		listingProgressCandidates: { one: '{count} candidate', other: '{count} candidates' },
		listingProgressChecked: '{count} checked',
		listingProgressUnavailable: '{count} unavailable',
		listingProgressLoadedTokens: 'among {count} loaded tokens',
		summaryListingsSoFar: { one: '{count} live listing so far', other: '{count} live listings so far' },
		summaryOffersSoFar: { one: '{count} live offer so far', other: '{count} live offers so far' },
		summaryNamespaceMatches: '{count} current namespace matches',
		summaryLoadedMatches: '{count} loaded matches',
		summaryInitialMatches: '{count} loaded names beginning with {initial}',
		summaryLiveListings: { one: '{count} live listing', other: '{count} live listings' },
		summaryLiveListingsInLoadedTokens: {
			one: '{count} live listing in loaded tokens',
			other: '{count} live listings in loaded tokens',
		},
		summaryNamesLoadedMore: '{count} current names loaded · more available',
		summaryNames: { one: '{count} current name', other: '{count} current names' },
		summaryTokensLoadedMore: '{count} tokens loaded · more available',
		summaryTokens: { one: '{count} token', other: '{count} tokens' },
		summaryAssets: { one: '{count} asset', other: '{count} assets' },

		// Polite announcements
		announcementSearchingListings: 'Searching Arweave for live listings in {collection}: {progress}.',
		announcementCheckingOffers: 'Checking live offers in {collection} while all items remain visible.',
		announcementCheckingPrices: 'Checking live prices for {count} visible assets in {collection}.',
		announcementNamesMatch: '{count} names match {query} in {collection}.',
		announcementAssetsMatch: '{count} assets match {query} in {collection}.',
		announcementNoLoadedTokensMatch:
			'No loaded tokens match {query} in {collection}; more token records remain available.',
		announcementNoNamesMatch: 'No names match {query} in {collection}.',
		announcementNoAssetsMatch: 'No assets match {query} in {collection}.',
		announcementSummary: '{summary} in {collection}.',

		// Activity feed
		activityFeedScope: 'This feed covers {loaded} of {total} discovered tokens currently loaded in the collection.',
		activityFeedOpenCollection: 'Open collection to load more',
		activityInterrupted: 'Activity scanning was interrupted. {error}',
		activityInterruptedWithEvents:
			'Activity scanning was interrupted. {count} existing events remain visible. {error}',
		activityListLabel: 'Recent market activity',
		activityShowing: 'Showing {shown} of {total} indexed activity events.',
		activityShowMore: 'Show {count} more activity events',
		activityLoading: 'Reading indexed collection activity from Arweave…',
		activityEmptyTitle: 'No indexed market activity yet',
		activityEmptyDetail: 'This collection has no matching signed market actions in the current Arweave index.',
	},
});

export type CollectionMessages = (typeof COLLECTION_MESSAGES)['en'];

/** The plural formatter `usePlural()` returns, passed to React-independent `model/` helpers. */
export type CollectionPlural = (message: PluralMessage, count: number, values?: MessageValues) => string;
