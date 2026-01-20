import { readHandler } from 'api';
import { getAssetByIdGQL } from 'api/assets';

import { AO, getDefaultToken, HB } from 'helpers/config';

// Spam address to filter out from collections
const SPAM_ADDRESS = 'DwYZmjS7l6NHwojaH7-LzRBb4RiwjshGQm7-1ApDObw';
import { executeGraphQLQueryWithRetry } from 'helpers/graphql';
import {
	CollectionDetailType,
	CollectionMetricsType,
	CollectionType,
	OrderbookEntryType,
	StampsType,
} from 'helpers/types';
import { getTagValue, sortOrderbookEntries } from 'helpers/utils';
import { store } from 'store';
import * as collectionActions from 'store/collections/actions';

export async function getCollections(creator: string, libs: any): Promise<any[]> {
	try {
		const response = await libs.readState({
			processId: AO.collectionsRegistry,
			path: 'cache',
			fallbackAction: 'Get-Collections',
			node: HB.defaultNode,
		});

		if (response?.Collections?.length) {
			let filteredCollections = [...response.Collections];
			if (creator) {
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

			// const stampsFetch: StampsType = await stamps.getStamps({ ids: collectionIds });
			const stampsFetch: StampsType = {};

			let finalCollections = collections;

			finalCollections = finalCollections.filter((c: any) => {
				return stampsFetch[c.id]?.total != 0;
			});

			finalCollections = finalCollections.sort((a: { id: string | number }, b: { id: string | number }) => {
				const countA = stampsFetch[a.id]?.total || 0;
				const countB = stampsFetch[b.id]?.total || 0;
				return countB - countA;
			});

			const key = creator ? 'creators' : 'stamped';
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

export async function getCollectionById(args: { id: string; libs?: any }): Promise<CollectionDetailType> {
	try {
		let response: any = null;
		if (args.libs) {
			response = await args.libs.getCollection(args.id);
		} else {
			response = await readHandler({
				processId: args.id,
				action: 'Info',
			});
		}

		if (response) {
			const collection: CollectionType = {
				id: args.id,
				...args.libs.mapFromProcessCase(response),
			};

			let assetIds: string[] = response.assets;

			let activity: any = {};
			if (collection.activityProcess && args.libs) {
				try {
					const activityResponse = await args.libs.readState({
						processId: collection.activityProcess,
						path: 'activity',
						fallbackAction: 'Info',
						node: HB.defaultNode,
					});
					if (activityResponse) activity = args.libs.mapFromProcessCase({ ...activityResponse });
				} catch (e) {
					console.error('Failed to fetch CurrentListings:', e);
				}
			}

			let metrics: CollectionMetricsType;
			const totalAssets = assetIds.length;

			if (activity?.currentListings && Object.keys(activity?.currentListings).length > 0) {
				let globalFloor = Infinity;
				let globalCurrency = getDefaultCurrency(assetIds);
				let listedCount = 0;

				for (const assetId of assetIds) {
					const entry = activity?.currentListings[assetId];
					if (entry) {
						listedCount++;
						const raw = activity?.currentListings[assetId];
						if (!raw) continue;
						const bucket = raw as Record<string, { quantity: string; floorPrice: string }>;

						for (const [currency, { floorPrice }] of Object.entries(bucket)) {
							const priceNum = Number(floorPrice);
							if (priceNum < globalFloor) {
								globalFloor = priceNum;
								globalCurrency = currency;
							}
						}
					}
				}

				metrics = {
					assetCount: totalAssets,
					floorPrice: globalFloor === Infinity ? 0 : globalFloor,
					percentageListed: totalAssets === 0 ? 0 : listedCount / totalAssets,
					defaultCurrency: globalCurrency,
				};
			} else {
				metrics = {
					assetCount: totalAssets,
					floorPrice: getFloorPrice(assetIds),
					percentageListed: getPercentageListed(assetIds),
					defaultCurrency: getDefaultCurrency(assetIds),
				};
			}

			const collectionDetail = {
				...collection,
				assetIds: assetIds,
				creatorProfile: null,
				metrics: metrics,
				activity: activity,
			};

			return collectionDetail;
		}

		return null;
	} catch (e: any) {
		throw new Error(e.message || 'Failed to fetch collection');
	}
}

export async function getMusicCollections(creator: string, libs: any): Promise<any[]> {
	try {
		// First get all collections
		const allCollections = await getCollections(creator, libs);

		if (!allCollections || allCollections.length === 0) {
			return [];
		}

		const musicCollections = [];

		// Check each collection for music assets
		for (let i = 0; i < allCollections.length; i++) {
			const collection = allCollections[i];

			try {
				const collectionDetail = await getCollectionById({ id: collection.id, libs });

				if (collectionDetail && collectionDetail.assetIds && collectionDetail.assetIds.length > 0) {
					// Check if any assets in the collection are music or podcast-related
					let hasMusicOrPodcastAssets = false;

					// Sample a few assets to check for music/podcasts (to avoid too many API calls)
					const sampleSize = Math.min(5, collectionDetail.assetIds.length);
					const sampleAssetIds = collectionDetail.assetIds.slice(0, sampleSize);

					for (const assetId of sampleAssetIds) {
						try {
							const structuredAsset = await getAssetByIdGQL({ id: assetId });

							if (structuredAsset && structuredAsset.data) {
								// Check if it's an audio file
								const isAudio =
									structuredAsset.data.contentType && structuredAsset.data.contentType.startsWith('audio/');

								// Check if it has music or podcast-related topics
								const hasMusicOrPodcastTopics =
									structuredAsset.data.topics &&
									(structuredAsset.data.topics.includes('Music') ||
										structuredAsset.data.topics.includes('Bazar Music') ||
										structuredAsset.data.topics.includes('ALBUM') ||
										structuredAsset.data.topics.includes('Cover Art') ||
										structuredAsset.data.topics.includes('podcast') ||
										structuredAsset.data.topics.includes('bazar podcast'));

								if (isAudio || hasMusicOrPodcastTopics) {
									hasMusicOrPodcastAssets = true;
									break;
								}
							}
						} catch (e) {
							console.error(`Error checking asset ${assetId}:`, e);
							continue;
						}
					}

					if (hasMusicOrPodcastAssets) {
						musicCollections.push(collection);
					}
				}
			} catch (e) {
				console.error(`Error checking collection ${collection.id}:`, e);
				continue;
			}
		}

		return musicCollections;
	} catch (e: any) {
		throw new Error(e.message || 'Failed to fetch music collections');
	}
}

export async function getAllMusicCollections(libs: any): Promise<CollectionType[]> {
	try {
		// Check Redux cache first
		const state = store.getState().collectionsReducer;
		const cachedMusic = state?.music;
		const cacheAge = cachedMusic?.lastUpdate ? Date.now() - cachedMusic.lastUpdate : Infinity;
		const cacheDuration = 2 * 60 * 1000; // 2 minutes (reduced for faster updates)

		if (cachedMusic?.collections && cacheAge < cacheDuration) {
			return cachedMusic.collections;
		}

		// Set to store unique music collection IDs
		const musicCollectionIds = new Set<string>();

		// Use a more targeted search for Bazar Music assets with cover art

		try {
			// Search for all assets with Bootloader-CoverArt tag using pagination
			const query = `query BootloaderCoverArt($cursor: String) {
				transactions(
					tags: [
						{ name: "Bootloader-CoverArt", values: [""] }
					]
					first: 50
					sort: HEIGHT_DESC
					after: $cursor
				) {
					pageInfo {
						hasNextPage
					}
					edges {
						cursor
						node {
							id
							tags {
								name
								value
							}
							block {
								height
								timestamp
							}
						}
					}
				}
			}`;

			let success = false;
			let cursor: string | null = null;
			let hasNextPage = true;
			let pageCount = 0;
			const maxPages = 10; // Limit to prevent infinite loops, fetch up to 500 assets (10 pages * 50)

			// Fetch all pages
			while (hasNextPage && pageCount < maxPages) {
				try {
					const variables = cursor ? { cursor } : {};
					const result = await executeGraphQLQueryWithRetry(query, variables, 2);
					const data = result?.data?.transactions;
					const edges = data?.edges ?? [];
					const pageInfo = data?.pageInfo;

					if (edges.length) {
						success = true;
					}

					for (const edge of edges) {
						try {
							const node = edge.node;
							const collectionId = getTagValue(node.tags, 'Bootloader-CollectionId');

							if (collectionId) {
								// Include all collections with Cover Art assets
								// The presence of Bootloader-CoverArt tag already indicates it's music/podcast related
								musicCollectionIds.add(collectionId);
							}
						} catch (e) {
							console.error(`Error processing asset ${edge.node.id}:`, e);
							continue;
						}
					}

					// Check if there are more pages
					pageCount++;
					hasNextPage = pageInfo?.hasNextPage ?? false;
					if (hasNextPage && edges.length > 0) {
						cursor = edges[edges.length - 1].cursor;
					} else {
						hasNextPage = false;
					}
				} catch (graphQLError) {
					console.error('Error executing music collections GraphQL query:', graphQLError);
					hasNextPage = false; // Stop pagination on error
				}
			}

			if (!success) {
				// Fallback to known music collection
				musicCollectionIds.add('3oz9r4M8aT1-wcbKmv5rYixUdWdCKYRmMMmfsqbTgCQ'); // Known collection ID
			}
		} catch (e) {
			console.error('Error in GraphQL search:', e);
			// Fallback to known collection
			musicCollectionIds.add('3oz9r4M8aT1-wcbKmv5rYixUdWdCKYRmMMmfsqbTgCQ');
		}

		// Fetch all the music collections
		const musicCollections: CollectionType[] = [];

		for (const collectionId of musicCollectionIds) {
			try {
				let collection;
				try {
					collection = await libs.getCollection(collectionId);
				} catch (hyperbeamError) {
					console.warn(`[Music Collections] HyperBEAM failed for ${collectionId}, using fallback:`, hyperbeamError);
					// Create fallback collection data
					collection = {
						id: collectionId,
						title: `Podcast Collection ${collectionId.slice(0, 8)}`,
						name: `Podcast Collection ${collectionId.slice(0, 8)}`,
						description: 'Podcast collection from Arweave',
						creator: '',
						dateCreated: Date.now(),
						banner: null,
						thumbnail: null,
						activityProcess: null,
					};
				}

				if (collection) {
					// Remove emojis from title (simple approach)
					const cleanTitle = (collection.title || collection.name || 'Music Collection')
						.replace(/[^\x00-\x7F]/g, '') // Remove non-ASCII characters (including emojis)
						.trim();

					// Filter out test collections
					if (cleanTitle.toLowerCase().includes('test')) {
						continue;
					}

					const mappedCollection: CollectionType = {
						id: collection.id || collectionId,
						title: cleanTitle || 'Music Collection',
						description: collection.description || '',
						creator: collection.creator || '',
						dateCreated: collection.dateCreated || Date.now(),
						banner: collection.banner || null,
						thumbnail: collection.thumbnail || null,
						activityProcess: collection.activityProcess || null,
					};

					// Ensure we're only adding collections, not individual assets
					// Also filter out collections from spam address
					if (
						mappedCollection.title &&
						!mappedCollection.title.includes('Back Then') &&
						!mappedCollection.title.includes('Echoes of Wisdom') &&
						!mappedCollection.title.toLowerCase().includes('test') &&
						mappedCollection.creator !== SPAM_ADDRESS
					) {
						musicCollections.push(mappedCollection);
					}
				}
			} catch (e) {
				console.error(`Error fetching collection ${collectionId}:`, e);
				continue;
			}
		}

		// Update Redux cache
		store.dispatch(
			collectionActions.setCollections({
				...(store.getState().collectionsReducer ?? {}),
				music: {
					collections: musicCollections,
					lastUpdate: Date.now(),
				},
			})
		);

		return musicCollections;
	} catch (e: any) {
		console.error('Error in getAllMusicCollections:', e);
		return [];
	}
}

export async function getAllEbookCollections(libs: any): Promise<CollectionType[]> {
	try {
		// Check Redux cache first
		const state = store.getState().collectionsReducer;
		const cachedEbooks = state?.ebooks;
		const cacheAge = cachedEbooks?.lastUpdate ? Date.now() - cachedEbooks.lastUpdate : Infinity;
		const cacheDuration = 2 * 60 * 1000; // 2 minutes (reduced for faster updates)

		if (cachedEbooks?.collections && cacheAge < cacheDuration) {
			return cachedEbooks.collections;
		}

		// Set to store unique ebook collection IDs
		const ebookCollectionIds = new Set<string>();

		// Use a more targeted search for ebook assets with ISBN tag
		try {
			// Search for all assets with Bootloader-ISBN tag using pagination
			const query = `query BootloaderISBN($cursor: String) {
				transactions(
					tags: [
						{ name: "Bootloader-ISBN", values: [""] }
					]
					first: 50
					sort: HEIGHT_DESC
					after: $cursor
				) {
					pageInfo {
						hasNextPage
					}
					edges {
						cursor
						node {
							id
							tags {
								name
								value
							}
							block {
								height
								timestamp
							}
						}
					}
				}
			}`;

			let cursor: string | null = null;
			let hasNextPage = true;
			let pageCount = 0;
			const maxPages = 10; // Limit to prevent infinite loops, fetch up to 500 assets (10 pages * 50)

			// Fetch all pages
			while (hasNextPage && pageCount < maxPages) {
				try {
					const variables = cursor ? { cursor } : {};
					const result = await executeGraphQLQueryWithRetry(query, variables, 2);
					const data = result?.data?.transactions;
					const edges = data?.edges ?? [];
					const pageInfo = data?.pageInfo;

					for (const edge of edges) {
						try {
							const node = edge.node;
							const collectionId = getTagValue(node.tags, 'Bootloader-CollectionId');

							if (collectionId) {
								// Include all collections with ISBN assets
								// The presence of Bootloader-ISBN tag already indicates it's an ebook
								ebookCollectionIds.add(collectionId);
							}
						} catch (e) {
							console.error(`Error processing asset ${edge.node.id}:`, e);
							continue;
						}
					}

					// Check if there are more pages
					pageCount++;
					hasNextPage = pageInfo?.hasNextPage ?? false;
					if (hasNextPage && edges.length > 0) {
						cursor = edges[edges.length - 1].cursor;
					} else {
						hasNextPage = false;
					}
				} catch (graphQLError) {
					console.error('Error executing ebook collections GraphQL query:', graphQLError);
					hasNextPage = false; // Stop pagination on error
				}
			}
		} catch (e) {
			console.error('Error in GraphQL search:', e);
		}

		// Fetch all the ebook collections
		const ebookCollections: CollectionType[] = [];

		for (const collectionId of ebookCollectionIds) {
			try {
				let collection: CollectionType | null = null;

				try {
					collection = await libs.getCollection(collectionId);
				} catch (hyperbeamError) {
					console.warn(`[Ebook Collections] HyperBEAM failed for ${collectionId}, using fallback:`, hyperbeamError);
					// Create fallback collection data
					collection = {
						id: collectionId,
						title: `Ebook Collection ${collectionId.slice(0, 8)}`,
						name: `Ebook Collection ${collectionId.slice(0, 8)}`,
						description: 'Ebook collection from Arweave',
						creator: '',
						dateCreated: Date.now().toString(),
						banner: null,
						thumbnail: null,
						activityProcess: null,
					};
				}

				if (collection) {
					// Remove emojis from title (simple approach)
					const cleanTitle = (collection.title || collection.name || 'Ebook Collection')
						.replace(/[^\x00-\x7F]/g, '') // Remove non-ASCII characters (including emojis)
						.trim();

					// Filter out test collections
					if (cleanTitle.toLowerCase().includes('test')) {
						continue;
					}

					const mappedCollection: CollectionType = {
						id: collection.id || collectionId,
						title: cleanTitle || 'Ebook Collection',
						description: collection.description || '',
						creator: collection.creator || '',
						dateCreated: collection.dateCreated || Date.now().toString(),
						banner: collection.banner || null,
						thumbnail: collection.thumbnail || null,
						activityProcess: collection.activityProcess || null,
					};

					// Ensure we're only adding collections, not individual assets
					// Also filter out collections from spam address
					if (
						mappedCollection.title &&
						!mappedCollection.title.includes('Back Then') &&
						!mappedCollection.title.includes('Echoes of Wisdom') &&
						!mappedCollection.title.toLowerCase().includes('test') &&
						mappedCollection.creator !== SPAM_ADDRESS
					) {
						ebookCollections.push(mappedCollection);
					}
				}
			} catch (e) {
				console.error(`Error fetching collection ${collectionId}:`, e);
				continue;
			}
		}

		// Update Redux cache
		store.dispatch(
			collectionActions.setCollections({
				...(store.getState().collectionsReducer ?? {}),
				ebooks: {
					collections: ebookCollections,
					lastUpdate: Date.now(),
				},
			})
		);

		return ebookCollections;
	} catch (e: any) {
		console.error('Error in getAllEbookCollections:', e);
		return [];
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
	return getDefaultToken().id;
}
