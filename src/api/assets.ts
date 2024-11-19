import { getGQLData, readHandler } from 'api';

import { AO, GATEWAYS, LICENSES, PAGINATORS, REFORMATTED_ASSETS, TAGS } from 'helpers/config';
import {
	AssetDetailType,
	AssetOrderType,
	AssetSortType,
	AssetStateType,
	AssetType,
	DefaultGQLResponseType,
	EntryOrderType,
	GQLNodeResponseType,
	IdGroupType,
	LicenseType,
	OrderbookEntryType,
} from 'helpers/types';
import { formatAddress, getAssetOrderType, getTagValue, sortByAssetOrders, sortOrderbookEntries } from 'helpers/utils';
import { store } from 'store';

export async function getAssetIdsByUser(args: { profileId: string }): Promise<string[]> {
	try {
		const fetchedProfile = await readHandler({
			processId: args.profileId,
			action: 'Info',
			data: null,
		});

		if (fetchedProfile) {
			return fetchedProfile.Assets.map((asset: { Id: string; Quantity: string }) => asset.Id);
		} else return [];
	} catch (e: any) {
		console.error(e);
	}
}

export async function getAssetsByIds(args: { ids: string[]; sortType: AssetSortType }): Promise<AssetDetailType[]> {
	try {
		const gqlResponse = await getGQLData({
			gateway: GATEWAYS.arweave,
			ids: args.ids,
			tagFilters: null,
			owners: null,
			cursor: null,
		});

		if (gqlResponse && gqlResponse.data.length) {
			if (store.getState().ucmReducer) {
				const ucmReducer = store.getState().ucmReducer;
				const stampsReducer = store.getState().stampsReducer;

				const finalAssets: AssetDetailType[] = [];
				const structuredAssets = structureAssets(gqlResponse);

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

				return sortByAssetOrders(finalAssets, args.sortType, stampsReducer);
			}

			return sortByAssetOrders([], args.sortType, {});
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
				logo: null,
				balances: null,
				transferable: null,
			};

			const structuredAsset = structureAssets(gqlResponse)[0];

			const processState = await readHandler({
				processId: structuredAsset.data.id,
				action: 'Info',
				data: null,
			});

			if (processState) {
				if (processState.Name || processState.name) {
					assetState.name = processState.Name || processState.name;
					structuredAsset.data.title = processState.Name || processState.name;
				}
				if (processState.Ticker || processState.ticker) assetState.ticker = processState.Ticker || processState.ticker;
				if (processState.Denomination || processState.denomination)
					assetState.denomination = processState.Denomination || processState.denomination;
				if (processState.Logo || processState.logo) assetState.logo = processState.Logo || processState.logo;
				if (processState.Balances) {
					assetState.balances = Object.fromEntries(
						Object.entries(processState.Balances).filter(([_, value]) => Number(value) !== 0)
					) as any;
				}
				if (processState.Transferable !== undefined) {
					assetState.transferable = processState.Transferable;
				} else {
					assetState.transferable = true;
				}
			}

			if (!assetState.balances) {
				try {
					const processBalances = await readHandler({
						processId: structuredAsset.data.id,
						action: 'Balances',
						data: null,
					});

					if (processBalances) assetState.balances = processBalances;
				} catch (e: any) {
					console.error(e);
				}
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
		let title =
			getTagValue(element.node.tags, TAGS.keys.title) ||
			getTagValue(element.node.tags, TAGS.keys.name) ||
			formatAddress(element.node.id, false);

		if (REFORMATTED_ASSETS[element.node.id]) title = REFORMATTED_ASSETS[element.node.id].title;

		structuredAssets.push({
			data: {
				id: element.node.id,
				creator: getTagValue(element.node.tags, TAGS.keys.creator),
				title: title,
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
				collectionId: getTagValue(element.node.tags, TAGS.keys.collectionId),
				collectionName: getTagValue(element.node.tags, TAGS.keys.collectionName),
				contentType: getTagValue(element.node.tags, TAGS.keys.contentType),
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
			currency: getTagValue(element.node.tags, TAGS.keys.currency),
		};
	}
	return null;
}

export function getAssetIdGroups(args: {
	ids?: string[];
	groupCount: number | null;
	filterListings: boolean;
	sortType: AssetSortType;
}): IdGroupType {
	if (store.getState().ucmReducer) {
		const ucmReducer = store.getState().ucmReducer;
		const stampsReducer = store.getState().stampsReducer;
		const idGroup: any = {};
		const groupCount: number = args.groupCount || PAGINATORS.default;

		if (ucmReducer.Orderbook) {
			let currentOrderbook = ucmReducer.Orderbook;

			if (args.ids) {
				currentOrderbook = currentOrderbook.filter((entry: OrderbookEntryType) => args.ids.includes(entry.Pair[0]));

				const orderbookIds = currentOrderbook.map((entry: OrderbookEntryType) => entry.Pair[0]);
				const missingIds = args.ids.filter((id) => !orderbookIds.includes(id));

				missingIds.forEach((missingId) => {
					currentOrderbook.push({ Pair: [missingId, AO.defaultToken], Orders: [] });
				});
			}

			if (args.filterListings) {
				currentOrderbook = currentOrderbook.filter(
					(entry: OrderbookEntryType) => entry.Orders && entry.Orders.length > 0
				);
			}

			const sortedOrderbook = sortOrderbookEntries(currentOrderbook, args.sortType, stampsReducer);

			for (let i = 0, j = 0; i < sortedOrderbook.length; i += groupCount, j++) {
				idGroup[j] = sortedOrderbook.slice(i, i + groupCount).map((entry: OrderbookEntryType) => entry.Pair[0]);
			}
			return idGroup;
		}
	}
	return { '0': [] };
}
