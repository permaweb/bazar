import { getGQLData, getProfileByWalletAddress } from 'api';

import { GATEWAYS, PROCESSES, TAGS } from 'helpers/config';
import { getTxEndpoint } from 'helpers/endpoints';
import {
	CollectionDetailType,
	CollectionGQLResponseType,
	CollectionManifestType,
	CollectionMetricsType,
	CollectionType,
	DefaultGQLResponseType,
	OrderbookEntryType,
} from 'helpers/types';
import { formatAddress, getTagValue, sortOrderbookEntries } from 'helpers/utils';
import { store } from 'store';

export async function getCollections(args: {
	cursor: string | null;
	owner: string | null;
}): Promise<CollectionGQLResponseType> {
	try {
		let collections: CollectionType[] = [];
		let count: number = 0;
		let nextCursor: string | null = null;
		let previousCursor: string | null = null;

		const tagFilters = [{ name: TAGS.keys.dataProtocol, values: [TAGS.values.collection] }];
		if (args.owner) tagFilters.push({ name: TAGS.keys.creator, values: [args.owner] });

		const gqlResponse = await getGQLData({
			gateway: GATEWAYS.arweave,
			ids: null,
			tagFilters: tagFilters,
			owners: null,
			cursor: args.cursor,
		});

		if (gqlResponse && gqlResponse.data.length) {
			collections = structureCollections(gqlResponse);
			count = gqlResponse.count;
			nextCursor = gqlResponse.nextCursor;
			previousCursor = gqlResponse.previousCursor;
		}

		return {
			data: collections,
			count: count,
			nextCursor: nextCursor,
			previousCursor: previousCursor,
		};
	} catch (e: any) {
		throw new Error(e.message || 'Failed to fetch collections');
	}
}

export async function getCollectionById(args: { id: string }): Promise<CollectionDetailType> {
	try {
		const gqlResponse = await getGQLData({
			gateway: GATEWAYS.goldsky,
			ids: [args.id],
			tagFilters: null,
			owners: null,
			cursor: null,
		});

		if (gqlResponse && gqlResponse.data.length) {
			const structuredCollection = structureCollections(gqlResponse)[0];
			const creatorProfile = await getProfileByWalletAddress({ address: structuredCollection.data.creator });

			let assetIds: string[] = [];
			try {
				const collectionFetch = await fetch(getTxEndpoint(args.id));
				const collectionManifest: CollectionManifestType = await collectionFetch.json();
				if (collectionManifest && collectionManifest.items) assetIds = collectionManifest.items;
			} catch (e: any) {
				console.error(e);
			}

			const metrics: CollectionMetricsType = {
				assetCount: assetIds.length,
				floorPrice: getFloorPrice(assetIds),
				percentageListed: getPercentageListed(assetIds),
				defaultCurrency: getDefaultCurrency(assetIds),
			};

			const collectionDetail = {
				...structuredCollection,
				assetIds: assetIds,
				creatorProfile: creatorProfile,
				metrics: metrics,
			};
			return collectionDetail;
		}

		return null;
	} catch (e: any) {
		throw new Error(e.message || 'Failed to fetch collection');
	}
}

export function structureCollections(gqlResponse: DefaultGQLResponseType): CollectionType[] {
	const structuredCollections: CollectionType[] = [];

	for (const element of gqlResponse.data) {
		structuredCollections.push({
			data: {
				id: element.node.id,
				creator: getTagValue(element.node.tags, TAGS.keys.creator),
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
				banner: getTagValue(element.node.tags, TAGS.keys.banner),
				thumbnail: getTagValue(element.node.tags, TAGS.keys.thumbnail),
			},
		});
	}

	return structuredCollections;
}

function getFloorPrice(assetIds: string[]): number {
	if (store.getState().ucmReducer) {
		const ucmReducer = store.getState().ucmReducer;
		if (ucmReducer.Orderbook && ucmReducer.Orderbook.length) {
			const filteredEntries: OrderbookEntryType[] = ucmReducer.Orderbook.filter((entry: OrderbookEntryType) =>
				assetIds.includes(entry.Pair[0])
			);
			const sortedEntries: OrderbookEntryType[] = sortOrderbookEntries(filteredEntries, 'low-to-high');
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
			const sortedEntries: OrderbookEntryType[] = sortOrderbookEntries(filteredEntries, 'low-to-high');
			if (sortedEntries && sortedEntries.length) {
				const currentEntry = sortedEntries[0];
				return currentEntry.Pair[1];
			}
		}
	}
	return PROCESSES.token;
}
