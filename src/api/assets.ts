import { getGQLData, readHandler } from 'api';

import { AO, HB, LICENSES, PAGINATORS, REFORMATTED_ASSETS, TAGS } from 'helpers/config';
import { getBestGatewayForGraphQL } from 'helpers/endpoints';
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
	TagType,
} from 'helpers/types';
import { formatAddress, getAssetOrderType, getTagValue, sortByAssetOrders, sortOrderbookEntries } from 'helpers/utils';
import { store } from 'store';

const debug = (..._args: any[]) => {};

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
		const gateway = getBestGatewayForGraphQL();

		const gqlResponse = await getGQLData({
			gateway: gateway, // Use Wayfinder if available
			ids: args.ids,
			tagFilters: null,
			owners: null,
			cursor: null,
		});

		if (gqlResponse && gqlResponse.data.length) {
			const ucmReducer = store.getState().ucmReducer;
			const stampsReducer = store.getState().stampsReducer;

			const finalAssets: AssetDetailType[] = [];
			const structuredAssets = structureAssets(gqlResponse);

			structuredAssets.forEach((asset: AssetType) => {
				let assetOrders: AssetOrderType[] | null = null;
				const existingEntry = ucmReducer?.Orderbook?.find((entry: OrderbookEntryType) => {
					return entry.Pair ? entry.Pair[0] === asset.data.id : null;
				});

				if (existingEntry) {
					assetOrders = existingEntry.Orders.map((order: EntryOrderType) => {
						return getAssetOrderType(order, existingEntry.Pair[1]);
					});
				}

				const finalAsset: AssetDetailType = { ...asset };
				if (assetOrders) {
					finalAsset.orderbook = {
						id: AO.ucm,
						orders: assetOrders,
					};
				}

				finalAssets.push(finalAsset);
			});

			const sortedAssets = sortByAssetOrders(finalAssets, args.sortType, stampsReducer);
			return sortedAssets;
		}

		return null;
	} catch (e: any) {
		throw new Error(e.message || 'Failed to fetch assets');
	}
}

export async function getAssetById(args: { id: string; libs?: any }): Promise<AssetDetailType> {
	try {
		const assetLookupResponse = await getGQLData({
			gateway: getBestGatewayForGraphQL(), // Use Wayfinder if available
			ids: [args.id],
			tagFilters: null,
			owners: null,
			cursor: null,
		});

		if (assetLookupResponse && assetLookupResponse.data.length) {
			let assetState: AssetStateType = {
				name: null,
				ticker: null,
				denomination: null,
				logo: null,
				balances: null,
				transferable: null,
			};

			const structuredAsset = structureAssets(assetLookupResponse)[0];

			let processState: any;

			// Try Hyperbean first (more efficient), fall back to dryrun if it fails
			if (args.libs) {
				try {
					processState = await args.libs.readState({
						processId: structuredAsset.data.id,
						path: 'asset',
						fallbackAction: 'Info',
						node: HB.defaultNode,
					});
				} catch (e) {
					console.log('Hyperbean failed, falling back to dryrun:', e);
					processState = await readHandler({
						processId: structuredAsset.data.id,
						action: 'Info',
						data: null,
					});
				}
			} else {
				processState = await readHandler({
					processId: structuredAsset.data.id,
					action: 'Info',
					data: null,
				});
			}

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
					assetState.transferable = processState.Transferable.toString() === 'true';
				} else {
					assetState.transferable = true;
				}

				// Include metadata in asset state
				if (processState.Metadata) {
					assetState.metadata = processState.Metadata;
				}
			}

			if (!assetState.balances) {
				debug('Getting balances...');
				try {
					await new Promise((r) => setTimeout(r, 1000));

					// Try Hyperbean first for balances too
					let processBalances: any;
					if (args.libs) {
						try {
							processBalances = await args.libs.readState({
								processId: structuredAsset.data.id,
								path: 'balances',
								fallbackAction: 'Balances',
								node: HB.defaultNode,
							});
						} catch (e) {
							console.log('Hyperbean balances failed, falling back to dryrun:', e);
							processBalances = await readHandler({
								processId: structuredAsset.data.id,
								action: 'Balances',
								data: null,
							});
						}
					} else {
						processBalances = await readHandler({
							processId: structuredAsset.data.id,
							action: 'Balances',
							data: null,
						});
					}

					if (processBalances) assetState.balances = processBalances;
				} catch (e: any) {
					console.error(e);
				}
			}

			if (processState.Metadata?.CollectionId) structuredAsset.data.collectionId = processState.Metadata.CollectionId;

			let assetOrderbook = null;

			/* Check if metadata field is present to detect current assets. 
				Set legacy orderbook on legacy assets */
			if (processState.Metadata) {
				if (processState.Metadata.OrderbookId) assetOrderbook = { id: processState.Metadata.OrderbookId };
			} else {
				assetOrderbook = { id: AO.ucm, activityId: AO.ucmActivity };
			}
			return {
				...structuredAsset,
				state: assetState,
				orderbook: assetOrderbook,
			};
		}

		return null;
	} catch (e: any) {
		throw new Error(e.message || 'Failed to fetch asset');
	}
}

export function getExistingEntry(args: { id: string }) {
	const { ucmReducer } = store.getState();
	return ucmReducer?.Orderbook?.find((entry: any) => (entry.Pair ? entry.Pair[0] === args.id : null)) || null;
}

export function getAssetOrders(orderbook: { Pair: string[]; Orders: any } | null | undefined) {
	if (!orderbook || !orderbook.Orders) {
		return [];
	}

	let assetOrders: AssetOrderType[] | null = null;

	assetOrders = orderbook.Orders.map((order: any) => {
		let currentAssetOrder: AssetOrderType = {
			creator: order.Creator,
			dateCreated: order.DateCreated,
			id: order.Id,
			originalQuantity: order.OriginalQuantity,
			quantity: order.Quantity,
			token: order.Token,
			currency: orderbook.Pair[1],
		};

		// Always set price field, default to '0' if not provided
		currentAssetOrder.price = order.Price || '0';
		return currentAssetOrder;
	});

	return assetOrders;
}

export function structureAssets(gqlResponse: DefaultGQLResponseType): AssetType[] {
	const structuredAssets: AssetType[] = [];

	gqlResponse.data.forEach((element: GQLNodeResponseType) => {
		let title =
			getTagValue(element.node.tags, 'Bootloader-Name') ||
			getTagValue(element.node.tags, TAGS.keys.title) ||
			getTagValue(element.node.tags, TAGS.keys.name) ||
			getTagValue(element.node.tags, 'Bootloader-Name') ||
			formatAddress(element.node.id, false);

		if (REFORMATTED_ASSETS[element.node.id]) title = REFORMATTED_ASSETS[element.node.id].title;

		// Extract topics from tags
		const topics = element.node.tags
			.filter((tag: TagType) => tag.name.includes('topic'))
			.map((tag: TagType) => tag.value);

		structuredAssets.push({
			data: {
				id: element.node.id,
				creator: getTagValue(element.node.tags, TAGS.keys.creator),
				title: title,
				description:
					getTagValue(element.node.tags, TAGS.keys.description) ||
					getTagValue(element.node.tags, 'Bootloader-Description'),
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
				topics: topics,
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

// export function getAssetIdGroups(args: {
// 	ids?: string[];
// 	groupCount: number | null;
// 	filterListings: boolean;
// 	sortType: AssetSortType;
// }): IdGroupType {
// 	const idGroup: any = {};

// 	const groupCount: number = args.groupCount || PAGINATORS.default;

// 	for (let i = 0, j = 0; i < args.ids.length; i += groupCount, j++) {
// 		idGroup[j] = args.ids.slice(i, i + groupCount).map((id) => id);
// 	}

// 	return idGroup;
// }

export function getAssetIdGroups(args: {
	ids?: string[];
	groupCount: number | null;
	filterListings: boolean;
	sortType: AssetSortType;
}): IdGroupType {
	const ucmReducer = store.getState().ucmReducer;
	const stampsReducer = store.getState().stampsReducer;
	const idGroup: any = {};
	const groupCount: number = args.groupCount || PAGINATORS.default;

	if (ucmReducer?.Orderbook) {
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
	} else {
		for (let i = 0, j = 0; i < args.ids.length; i += groupCount, j++) {
			idGroup[j] = args.ids.slice(i, i + groupCount).map((id) => id);
		}
	}
	return idGroup;
}
