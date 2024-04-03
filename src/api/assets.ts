import { getGQLData, readProcessState } from 'api';

import { GATEWAYS, TAGS } from 'helpers/config';
import {
	AGQLResponseType,
	AssetDetailType,
	AssetOrderType,
	AssetStateType,
	AssetType,
	GQLNodeResponseType,
} from 'helpers/types';
import { formatAddress, getTagValue } from 'helpers/utils';
import { store } from 'store';

export async function getAssetById(args: { id: string }): Promise<AssetDetailType> {
	try {
		const gqlResponse = await getGQLData({
			gateway: GATEWAYS.arweave,
			ids: [args.id],
			tagFilters: null,
			owners: null,
			cursor: null,
		});

		if (gqlResponse && gqlResponse.data.length) {
			let assetState: AssetStateType = {
				name: null,
				ticker: null,
				denomination: null,
				balances: null,
			};

			const structuredAsset = structureAssets(gqlResponse)[0];
			const processState = await readProcessState(structuredAsset.data.id);

			if (processState) {
				if (processState.Name) assetState.name = processState.Name;
				if (processState.Ticker) assetState.ticker = processState.Ticker;
				if (processState.Denomination) assetState.denomination = processState.Denomination;
				if (processState.Balances) assetState.balances = processState.Balances;
			}

			let assetOrders: AssetOrderType[] | null = null;
			if (store.getState().ucmReducer) {
				const ucmReducer = store.getState().ucmReducer;
				const existingEntry = ucmReducer.Orderbook.find((entry: any) => {
					return entry.Pair ? entry.Pair[0] === args.id : null;
				});
				if (existingEntry) {
					assetOrders = existingEntry.Orders.map((order: any) => {
						let currentAssetOrder: AssetOrderType = {
							creator: order.Creator,
							dateCreated: order.DateCreated,
							depositTxId: order.DepositTxId,
							id: order.Id,
							originalQuantity: order.OriginalQuantity,
							quantity: order.Quantity,
							token: order.Token,
							currency: existingEntry.Pair[1],
						};

						if (order.Price) currentAssetOrder.price = order.Price;
						return currentAssetOrder;
					});
				}
			}

			const assetDetail: any = { ...structuredAsset, state: assetState };
			if (assetOrders) assetDetail.orders = assetOrders;
			return assetDetail;
		}

		return null;
	} catch (e: any) {
		throw new Error(e.message || 'Failed to fetch asset');
	}
}

function structureAssets(gqlData: AGQLResponseType): AssetType[] {
	const structuredAssets: AssetType[] = [];

	gqlData.data.forEach((element: GQLNodeResponseType) => {
		structuredAssets.push({
			data: {
				id: element.node.id,
				creator: getTagValue(element.node.tags, TAGS.keys.initialOwner),
				title:
					getTagValue(element.node.tags, TAGS.keys.title) ||
					getTagValue(element.node.tags, TAGS.keys.name) ||
					formatAddress(element.node.id, false),
				description: getTagValue(element.node.tags, TAGS.keys.description),
				dateCreated: element.node.block
					? element.node.block.timestamp * 1000
					: element.node.timestamp
					? element.node.timestamp
					: getTagValue(element.node.tags, TAGS.keys.dateCreated)
					? Number(getTagValue(element.node.tags, TAGS.keys.dateCreated))
					: 0,
				blockHeight: element.node.block ? element.node.block.height : 0,
				renderWith: getTagValue(element.node.tags, TAGS.keys.renderWith),
				license: getTagValue(element.node.tags, TAGS.keys.license),
				thumbnail: getTagValue(element.node.tags, TAGS.keys.thumbnail),
				implementation: getTagValue(element.node.tags, TAGS.keys.implements),
			},
		});
	});

	return structuredAssets;
}
