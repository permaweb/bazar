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
import * as collectionActions from 'store/collections/actions';

export async function getCollections(creator?: string, filterUnstamped?: boolean): Promise<CollectionType[]> {
	const dryrun = Math.random() < 0.1;

	// Define a key to use in localStorage for our TTL.
	const modeKey = 'fetchModeTTL';
	const currentTime = Date.now();
	let fetchMode;

	const storedData = localStorage.getItem(modeKey);
	if (storedData) {
		try {
			const parsedData = JSON.parse(storedData);
			if (currentTime - parsedData.timestamp < 60 * 60 * 1000) {
				fetchMode = 'compute';
			} else {
				fetchMode = 'now';
				localStorage.setItem(modeKey, JSON.stringify({ timestamp: currentTime }));
			}
		} catch (error) {
			fetchMode = 'now';
			localStorage.setItem(modeKey, JSON.stringify({ timestamp: currentTime }));
		}
	} else {
		fetchMode = 'now';
		localStorage.setItem(modeKey, JSON.stringify({ timestamp: currentTime }));
	}

	try {
		const response = dryrun
			? await readHandler({
					processId: AO.collectionsRegistry,
					action: creator ? 'Get-Collections-By-User' : 'Get-Collections',
					tags: creator ? [{ name: 'Creator', value: creator }] : null,
			  })
			: await (
					await fetch(`https://router-1.forward.computer/${AO.collectionsRegistry}~process@1.0/${fetchMode}/cache`)
			  ).json();

		if (response?.Collections?.length) {
			let filteredCollections = [...response.Collections];
			if (!dryrun && creator) {
				const creatorCollectionIds = [...(response.CollectionsByUser?.[creator] ?? [])];
				filteredCollections = filteredCollections.filter((collection) => creatorCollectionIds.includes(collection.Id));
			}

			const collections = filteredCollections.map((collection: any) => {
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
				return countB - countA;
			});

			const key = creator ? 'creators' : filterUnstamped ? 'stamped' : 'all';
			const updatedCollections = {
				[key]: creator
					? {
							[creator]: {
								collections: finalCollections,
								lastUpdate: Date.now(),
							},
					  }
					: {
							collections: finalCollections,
							lastUpdate: Date.now(),
					  },
			};

			store.dispatch(
				collectionActions.setCollections({
					...(store.getState().collectionsReducer ?? {}),
					...updatedCollections,
				})
			);

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
