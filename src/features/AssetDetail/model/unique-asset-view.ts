import { type AssetSummary, type Collection, collectionMoreAssets } from 'api/collections';
import type { CollectionActivityEvent } from 'api/discovery';
import {
	assetBalanceStateAvailable,
	type AssetState,
	licenseProperties,
	liveOrderOfAsset,
	ownerOfAsset,
	type SwapOrder,
} from 'api/marketplace';
import type { OperationActivityPhase } from 'api/operations';

import { assetDescription, unitPriceWinston } from 'features/Catalogue';
import { atomicOrderCanBeBought, externalReservationTransaction } from 'features/Operations';

import type { AssetDetailMessages } from '../messages';

import { collectionDescriptionFallback } from './asset-detail';
import { licenseDisplayProperties, type LicenseDisplayProperty } from './license-display';

export type UniqueAssetView = {
	owner: string | null;
	order: SwapOrder | null;
	/** The live order when it is open to buyers. */
	buyableOrder: SwapOrder | null;
	balanceStateAvailable: boolean;
	/** The connected wallet owns the asset. */
	mine: boolean;
	/** A reservation this wallet made in another tab, ready to pay from this one. */
	externalReservation: CollectionActivityEvent | null;
	license: LicenseDisplayProperty[];
	description: string;
	moreAssets: AssetSummary[];
	/** The unit ask in winston for the price chart's floor line. */
	floorValue: string | null;
	/** A saved recovery or an operation in progress blocks every action. */
	operationBlocksActions: boolean;
	/** Continuing an action also needs settled, error-free live state. */
	liveActionBlocked: boolean;
	/** Starting a new action also needs a complete holder balance table. */
	newOperationBlocksActions: boolean;
	operationIsBusy: boolean;
};

/** Derive a unique asset page from live state, the connected wallet, and in-flight operations and recoveries. */
export function uniqueAssetView(input: {
	asset: AssetSummary;
	collection: Collection;
	state: AssetState;
	walletAddress: string | null;
	activity: CollectionActivityEvent[];
	loading: boolean;
	error: string | null;
	operationPhase: OperationActivityPhase | null;
	hasUnavailableRecovery: boolean;
	messages: AssetDetailMessages;
}): UniqueAssetView {
	const owner = ownerOfAsset(input.state);
	const order = liveOrderOfAsset(input.state);
	const balanceStateAvailable = assetBalanceStateAvailable(input.state);
	const operationBlocksActions = input.hasUnavailableRecovery || input.operationPhase !== null;
	const liveActionBlocked = operationBlocksActions || input.loading || Boolean(input.error);
	return {
		owner,
		order,
		buyableOrder: atomicOrderCanBeBought(order) ? order : null,
		balanceStateAvailable,
		mine: Boolean(input.walletAddress && owner === input.walletAddress),
		externalReservation: externalReservationTransaction(order, input.walletAddress, input.activity),
		license: licenseDisplayProperties(licenseProperties(input.state), input.messages),
		description: assetDescription(input.state, collectionDescriptionFallback(input.collection, input.messages)),
		moreAssets: collectionMoreAssets(input.collection.assets, input.asset.id),
		floorValue: order ? unitPriceWinston(order, input.state.denomination).toString() : null,
		operationBlocksActions,
		liveActionBlocked,
		newOperationBlocksActions: liveActionBlocked || !balanceStateAvailable,
		operationIsBusy: input.operationPhase !== null && input.operationPhase !== 'error',
	};
}
