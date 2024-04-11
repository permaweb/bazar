import { getGQLData, readProcessState } from 'api';

import { GATEWAYS, LICENSES, PAGINATORS, TAGS } from 'helpers/config';
import {
	AssetDetailType,
	AssetOrderType,
	AssetStateType,
	AssetType,
	DefaultGQLResponseType,
	EntryOrderType,
	GQLNodeResponseType,
	IdGroupType,
	LicenseType,
	OrderbookEntryType,
} from 'helpers/types';
import { formatAddress, getAssetOrderType, getTagValue } from 'helpers/utils';
import { store } from 'store';

export async function getAssetsByIds(args: { ids: string[] }): Promise<AssetDetailType[]> {
	try {
		const gqlResponse = await getGQLData({
			gateway: GATEWAYS.arweave,
			ids: args.ids,
			tagFilters: null,
			owners: null,
			cursor: null,
		});

		if (gqlResponse && gqlResponse.data.length) {
			const finalAssets: AssetDetailType[] = [];
			const structuredAssets = structureAssets(gqlResponse);

			if (store.getState().ucmReducer) {
				const ucmReducer = store.getState().ucmReducer;

				structuredAssets.forEach((asset: AssetType) => {
					let assetOrders: AssetOrderType[] | null = null;
					const existingEntry = ucmReducer.Orderbook.find((entry: OrderbookEntryType) => {
						return entry.Pair ? entry.Pair[0] === asset.data.id : null;
					});

					if (existingEntry) {
						assetOrders = existingEntry.Orders.map((order: EntryOrderType) => {
							return getAssetOrderType(order, existingEntry.Pair[1]);
						});
					}

					const finalAsset: AssetDetailType = { ...asset };
					if (assetOrders) finalAsset.orders = assetOrders;
					finalAssets.push(finalAsset);
				});
			}

			return finalAssets;
		}

		return null;
	} catch (e: any) {
		throw new Error(e.message || 'Failed to fetch assets');
	}
}

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
				if (processState.Name) {
					assetState.name = processState.Name;
					structuredAsset.data.title = processState.Name;
				}
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

			const assetDetail: AssetDetailType = { ...structuredAsset, state: assetState };
			if (assetOrders) assetDetail.orders = assetOrders;
			return assetDetail;
		}

		return null;
	} catch (e: any) {
		throw new Error(e.message || 'Failed to fetch asset');
	}
}

export function structureAssets(gqlResponse: DefaultGQLResponseType): AssetType[] {
	const structuredAssets: AssetType[] = [];

	gqlResponse.data.forEach((element: GQLNodeResponseType) => {
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
				udl: getLicense(element),
				thumbnail: getTagValue(element.node.tags, TAGS.keys.thumbnail),
				implementation: getTagValue(element.node.tags, TAGS.keys.implements),
			},
		});
	});

	return structuredAssets;
}

function getLicense(element: GQLNodeResponseType): LicenseType | null {
	const license = getTagValue(element.node.tags, TAGS.keys.license);

	if (license && license === LICENSES.udl.address) {
		return {
			access: { value: getTagValue(element.node.tags, TAGS.keys.access) },
			derivations: { value: getTagValue(element.node.tags, TAGS.keys.derivations) },
			commercialUse: { value: getTagValue(element.node.tags, TAGS.keys.commericalUse) },
			dataModelTraining: { value: getTagValue(element.node.tags, TAGS.keys.dataModelTraining) },
			paymentMode: getTagValue(element.node.tags, TAGS.keys.paymentMode),
			paymentAddress: getTagValue(element.node.tags, TAGS.keys.paymentAddress),
		};
	}
	return null;
}

export function getOrderbookAssetIds(args: { groupCount: number | null }): IdGroupType {
	if (store.getState().ucmReducer) {
		const ucmReducer = store.getState().ucmReducer;
		const idGroup: any = {};
		const groupCount: number = args.groupCount || PAGINATORS.default;
		if (ucmReducer.Orderbook && ucmReducer.Orderbook.length) {
			for (let i = 0, j = 0; i < ucmReducer.Orderbook.length; i += groupCount, j++) {
				idGroup[j] = ucmReducer.Orderbook.slice(i, i + groupCount).map((entry: OrderbookEntryType) => entry.Pair[0]);
			}
			return idGroup;
		}
	}
	return { '0': [] };
}
