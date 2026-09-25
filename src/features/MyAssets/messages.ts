import { defineMessages } from 'helpers/i18n';

export const MY_ASSETS_MESSAGES = defineMessages({
	en: {
		myAssetsTitle: 'My assets',
		myAssetsWalletEyebrow: 'Your wallet',
		myAssetsInventoryEyebrow: 'Live wallet inventory',
		myAssetsSubtitle: 'Your assets, read from live Arweave state.',
		myAssetsGateway: 'Gateway',
		myAssetsConnectTitle: 'Connect a wallet to resolve its assets',
		myAssetsConnectDetail: 'No signature is requested. Candidate history and live state are read-only.',
		myAssetsCollectionsLoading: 'Reading supported asset collections from Arweave…',
		myAssetsCollectionsRouteLoading: 'Reading the supported asset collections from Arweave…',
		myAssetsRetry: 'Retry',
		myAssetsErrorHeading: 'Unable to load',
		myAssetsRouteEyebrow: 'Arweave marketplace',
		myAssetsBackAllCollections: 'All collections',
		myAssetsCandidatesUnavailable: {
			one: '{failureMessage} {failures} candidate remains unavailable. Resolved assets remain visible.',
			other: '{failureMessage} {failures} candidates remain unavailable. Resolved assets remain visible.',
		},
		myAssetsEmptyUncheckedTitle: 'Ownership could not be checked',
		myAssetsEmptyUncheckedDetail: '{failureMessage} {failures} of {total} candidates still need to be checked.',
		myAssetsEmptyTitle: 'No indexed candidates currently resolve to this address',
		myAssetsEmptyDetail:
			'Arweave GraphQL discovers candidates and can lag behind new transactions. Newly indexed candidates appear the next time this profile opens; live state remains authoritative for every candidate found.',

		myAssetsGroupTokens: 'Tokens',
		myAssetsGroupUniques: 'Uniques',
		myAssetsGroupHeading: '{title}, {count}',
		myAssetsGroupViewLabel: '{title} view',
		myAssetsGroupViewAll: 'All assets',
		myAssetsGroupViewListed: 'Listed for sale',
		myAssetsGroupAssetsTokens: 'tokens',
		myAssetsGroupAssetsUniques: 'uniques',
		myAssetsGroupAssetsListedTokens: 'listed tokens',
		myAssetsGroupAssetsListedUniques: 'listed uniques',
		myAssetsGroupRevealComplete: 'All {count} {assets} are shown.',
		myAssetsGroupRevealPartial: 'Showing {shown} of {count} {assets}.',
		myAssetsGroupEmpty: 'No {assets}.',
		myAssetsGroupChecking: 'Checking for {assets}…',
		myAssetsGroupShowMore: 'Show {count} more {assets}',
		myAssetsBadgeForSale: 'For sale',
		myAssetsBadgeOwned: 'Owned',
		myAssetsListedBalance: '{balance} listed',

		myAssetsResolutionDiscoveryInterrupted: 'Discovery interrupted',
		myAssetsResolutionDiscovering: 'Discovering and checking live state',
		myAssetsResolutionConfirmingOwnership: 'Confirming current ownership',
		myAssetsResolutionComputing: 'Computing live state',
		myAssetsResolutionCandidateChecksUnavailable: 'Candidate checks unavailable',
		myAssetsResolutionChecksPartiallyCompleted: 'Asset checks partially completed',
		myAssetsResolutionLiveStateUnavailable: 'Live state unavailable',
		myAssetsResolutionLiveStatePartiallyResolved: 'Live state partially resolved',
		myAssetsResolutionLiveStateResolved: 'Live state resolved',
		myAssetsResolutionInterrupted: 'Resolution interrupted',
		myAssetsAnnouncementDiscovering: 'Discovering and checking live state. {discovered} candidates found.',
		myAssetsAnnouncementDiscoveringChecked:
			'Discovering and checking live state. {discovered} candidates found, {checked} checked.',
		myAssetsAnnouncementConfirmingOwnership:
			'Confirming current ownership. {revalidated} of {total} visible assets rechecked without cached state.',
		myAssetsAnnouncementCheckingCandidates: 'Checking asset candidates. {percent}% complete.',
		myAssetsAnnouncementPartiallyResolved:
			'{failureMessage} {resolved} of {total} candidate checks completed; {failures} unavailable. Resolved assets remain visible.',
		myAssetsAnnouncementResolved: 'Live state resolved for {resolved} candidates.',
		myAssetsAnnouncementInterrupted: 'Asset resolution was interrupted.',
	},
});

export type MyAssetsMessages = (typeof MY_ASSETS_MESSAGES)['en'];
