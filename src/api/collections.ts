import { readHandler, stamps } from 'api';

import { AO, DEFAULTS } from 'helpers/config';
import {
	CollectionDetailType,
	CollectionMetricsType,
	CollectionType,
	OrderbookEntryType,
	StampsType,
} from 'helpers/types';
import { sortOrderbookEntries } from 'helpers/utils';
import { store } from 'store';

export async function getCollections(creator?: string, filterUnstamped?: boolean): Promise<CollectionType[]> {
	const action = creator ? 'Get-Collections-By-User' : 'Get-Collections';

	try {
		const response = await readHandler({
			processId: AO.collectionsRegistry,
			action: action,
			tags: creator ? [{ name: 'Creator', value: creator }] : null,
		});

		if (response && response.Collections && response.Collections.length) {
			const collections = response.Collections.map((collection: any) => {
				return {
					id: collection.Id,
					title: collection.Name.replace(/\[|\]/g, ''),
					description: collection.Description,
					creator: collection.Creator,
					dateCreated: collection.DateCreated,
					banner: collection.Banner,
					thumbnail: collection.Thumbnail,
				};
			});

			const collectionIds = collections.map((collection: any) => collection.id);
			const stampsFetch: StampsType = await stamps.getStamps({ ids: collectionIds });

			let finalCollections = collections;

			if (filterUnstamped) {
				finalCollections = finalCollections.filter((c: any) => {
					return stampsFetch[c.id].total != 0;
				});
			}

			finalCollections = finalCollections.sort((a: { id: string | number }, b: { id: string | number }) => {
				const countA = stampsFetch[a.id]?.total || 0;
				const countB = stampsFetch[b.id]?.total || 0;
				return countB - countA; // Descending order of total stamp counts
			});

			return finalCollections;
		}
		return null;
	} catch (e: any) {
		throw new Error(e.message || 'Failed to fetch collections');
	}
}

export async function getCollectionById(args: { id: string }): Promise<CollectionDetailType> {
	try {
		const response = await readHandler({
			processId: args.id,
			action: 'Info',
		});

		if (response) {
			const collection: CollectionType = {
				id: args.id,
				title: response.Name,
				description: response.Description,
				creator: response.Creator,
				dateCreated: response.DateCreated,
				banner: response.Banner ?? DEFAULTS.banner,
				thumbnail: response.Thumbnail ?? DEFAULTS.thumbnail,
			};

			let assetIds: string[] = response.Assets;

			const metrics: CollectionMetricsType = {
				assetCount: assetIds.length,
				floorPrice: getFloorPrice(assetIds),
				percentageListed: getPercentageListed(assetIds),
				defaultCurrency: getDefaultCurrency(assetIds),
			};

			const collectionDetail = {
				...collection,
				assetIds: assetIds,
				creatorProfile: null, // Async fetch from component level
				metrics: metrics,
			};
			return collectionDetail;
		}

		return null;
	} catch (e: any) {
		throw new Error(e.message || 'Failed to fetch collection');
	}
}

function getFloorPrice(assetIds: string[]): number {
	if (store.getState().ucmReducer) {
		const ucmReducer = store.getState().ucmReducer;
		if (ucmReducer.Orderbook && ucmReducer.Orderbook.length) {
			const filteredEntries: OrderbookEntryType[] = ucmReducer.Orderbook.filter((entry: OrderbookEntryType) =>
				assetIds.includes(entry.Pair[0])
			);
			const sortedEntries: OrderbookEntryType[] = sortOrderbookEntries(filteredEntries, 'low-to-high', {});
			if (sortedEntries && sortedEntries.length) {
				const currentEntry = sortedEntries[0];
				if (currentEntry.Orders && currentEntry.Orders.length && currentEntry.Orders[0].Price) {
					return Number(currentEntry.Orders[0].Price);
				}
			}
		}
	}
	return 0;
}

function getPercentageListed(assetIds: string[]): number {
	if (store.getState().ucmReducer) {
		const ucmReducer = store.getState().ucmReducer;
		if (ucmReducer.Orderbook && ucmReducer.Orderbook.length) {
			const filteredEntries: OrderbookEntryType[] = ucmReducer.Orderbook.filter((entry: OrderbookEntryType) =>
				assetIds.includes(entry.Pair[0])
			);
			const entriesWithOrders = filteredEntries.filter((entry) => entry.Orders && entry.Orders.length > 0);
			return entriesWithOrders.length / assetIds.length;
		}
	}
	return 0;
}

function getDefaultCurrency(assetIds: string[]): string {
	if (store.getState().ucmReducer) {
		const ucmReducer = store.getState().ucmReducer;
		if (ucmReducer.Orderbook && ucmReducer.Orderbook.length) {
			const filteredEntries: OrderbookEntryType[] = ucmReducer.Orderbook.filter((entry: OrderbookEntryType) =>
				assetIds.includes(entry.Pair[0])
			);
			const sortedEntries: OrderbookEntryType[] = sortOrderbookEntries(filteredEntries, 'low-to-high', {});
			if (sortedEntries && sortedEntries.length) {
				const currentEntry = sortedEntries[0];
				return currentEntry.Pair[1];
			}
		}
	}
	return AO.defaultToken;
}
