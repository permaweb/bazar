import { readHandler, stamps } from 'api';
import { getAssetById } from 'api/assets';

import { AO, HB } from 'helpers/config';
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

			const collectionIds = collections.map((collection: any) => collection.id);
			const stampsFetch: StampsType = await stamps.getStamps({ ids: collectionIds });

			let finalCollections = collections;

			finalCollections = finalCollections.filter((c: any) => {
				return stampsFetch[c.id].total != 0;
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
		console.log('🎵 Starting music collections fetch...');
		// First get all collections
		const allCollections = await getCollections(creator, libs);

		console.log(`🎵 Found ${allCollections?.length || 0} total collections`);

		if (!allCollections || allCollections.length === 0) {
			console.log('🎵 No collections found, returning empty array');
			return [];
		}

		const musicCollections = [];
		console.log('🎵 Starting to check collections for music assets...');

		// Check each collection for music assets
		for (let i = 0; i < allCollections.length; i++) {
			const collection = allCollections[i];
			console.log(`🎵 Checking collection ${i + 1}/${allCollections.length}: ${collection.title}`);

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
							const asset = await getAssetById({ id: assetId, libs });

							if (asset && asset.data) {
								// Check if it's an audio file
								const isAudio = asset.data.contentType && asset.data.contentType.startsWith('audio/');

								// Check if it has music or podcast-related topics
								const hasMusicOrPodcastTopics =
									asset.data.topics &&
									(asset.data.topics.includes('Music') ||
										asset.data.topics.includes('Bazar Music') ||
										asset.data.topics.includes('ALBUM') ||
										asset.data.topics.includes('Cover Art') ||
										asset.data.topics.includes('podcast') ||
										asset.data.topics.includes('bazar podcast'));

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
						console.log(`🎵 Found music/podcast collection: ${collection.title}`);
						musicCollections.push(collection);
					}
				}
			} catch (e) {
				console.error(`Error checking collection ${collection.id}:`, e);
				continue;
			}
		}

		console.log(`🎵 Music collections fetch complete. Found ${musicCollections.length} music collections`);
		return musicCollections;
	} catch (e: any) {
		throw new Error(e.message || 'Failed to fetch music collections');
	}
}

export async function getMusicCollectionsFromExisting(
	collections: CollectionType[],
	libs: any
): Promise<CollectionType[]> {
	try {
		console.log('🎵 Filtering existing collections for music...');

		if (!collections || collections.length === 0) {
			console.log('🎵 No collections to filter');
			return [];
		}

		const musicCollectionIds = new Set<string>();

		// Check each collection for music assets
		for (let i = 0; i < collections.length; i++) {
			const collection = collections[i];
			console.log(`🎵 Checking collection ${i + 1}/${collections.length}: ${collection.title}`);

			try {
				const collectionDetail = await getCollectionById({ id: collection.id, libs });

				if (collectionDetail && collectionDetail.assetIds && collectionDetail.assetIds.length > 0) {
					// Sample a few assets to check for music (to avoid too many API calls)
					const sampleSize = Math.min(3, collectionDetail.assetIds.length);
					const sampleAssetIds = collectionDetail.assetIds.slice(0, sampleSize);

					for (const assetId of sampleAssetIds) {
						try {
							const asset = await getAssetById({ id: assetId, libs });

							if (asset && asset.data) {
								// Check if it has music or podcast-related topics
								const hasMusicOrPodcastTopics =
									asset.data.topics &&
									(asset.data.topics.includes('Music') ||
										asset.data.topics.includes('Bazar Music') ||
										asset.data.topics.includes('ALBUM') ||
										asset.data.topics.includes('Cover Art') ||
										asset.data.topics.includes('podcast') ||
										asset.data.topics.includes('bazar podcast'));

								// Check if it's an audio file
								const isAudio = asset.data.contentType && asset.data.contentType.startsWith('audio/');

								if (hasMusicOrPodcastTopics || isAudio) {
									console.log(`🎵 Found music/podcast asset in collection ${collection.title}: ${asset.data.title}`);
									musicCollectionIds.add(collection.id);
									break; // Found music/podcast in this collection, move to next collection
								}
							}
						} catch (e) {
							console.error(`Error checking asset ${assetId}:`, e);
							continue;
						}
					}
				}
			} catch (e) {
				console.error(`Error checking collection ${collection.id}:`, e);
				continue;
			}
		}

		// Filter collections to only include those with music assets
		const musicCollections = collections.filter((collection) => musicCollectionIds.has(collection.id));

		console.log(
			`🎵 Found ${musicCollections.length} music collections:`,
			musicCollections.map((c) => c.title)
		);
		return musicCollections;
	} catch (e: any) {
		console.error('Error filtering music collections:', e);
		return [];
	}
}

export async function getMusicCollectionsEfficient(libs: any): Promise<CollectionType[]> {
	try {
		console.log('🎵 Efficiently searching for music collections...');

		// First, let's get all collections
		const allCollections = await getCollections(null, libs);

		if (!allCollections || allCollections.length === 0) {
			console.log('🎵 No collections found');
			return [];
		}

		// For now, let's search for collections that might contain music or podcasts
		// We'll look for collections with music/podcast-related names or descriptions
		const musicCollections = allCollections.filter((collection) => {
			const title = collection.title?.toLowerCase() || '';
			const description = collection.description?.toLowerCase() || '';

			const musicAndPodcastKeywords = [
				'music',
				'album',
				'track',
				'song',
				'audio',
				'sound',
				'beat',
				'mix',
				'playlist',
				'ep',
				'single',
				'remix',
				'instrumental',
				'vocal',
				'podcast',
				'episode',
				'show',
				'radio',
				'broadcast',
				'stream',
			];

			return musicAndPodcastKeywords.some((keyword) => title.includes(keyword) || description.includes(keyword));
		});

		console.log(`🎵 Found ${musicCollections.length} potential music/podcast collections by keyword search`);

		// If we don't find any by keywords, return empty array
		if (musicCollections.length === 0) {
			console.log('🎵 No music collections found by keywords');
			return [];
		}

		return musicCollections;
	} catch (e: any) {
		console.error('Error in efficient music collections search:', e);
		return [];
	}
}

export async function getMusicCollectionsByAssetTopics(libs: any): Promise<CollectionType[]> {
	try {
		console.log('🎵 Searching for music assets by topics...');

		// First, let's get all collections to have them ready
		const allCollections = await getCollections(null, libs);

		if (!allCollections || allCollections.length === 0) {
			console.log('🎵 No collections found');
			return [];
		}

		// Create a map of collection ID to collection for quick lookup
		const collectionsMap = new Map<string, CollectionType>();
		allCollections.forEach((collection) => {
			collectionsMap.set(collection.id, collection);
		});

		console.log(`🎵 Loaded ${allCollections.length} collections for lookup`);

		// Set to store unique collection IDs that contain music assets
		const musicCollectionIds = new Set<string>();

		// Search for assets with music topics
		// We'll search through a subset of collections to find music assets
		const searchLimit = Math.min(20, allCollections.length); // Limit to first 20 collections for performance

		for (let i = 0; i < searchLimit; i++) {
			const collection = allCollections[i];
			console.log(`🎵 Searching collection ${i + 1}/${searchLimit}: ${collection.title}`);

			try {
				const collectionDetail = await getCollectionById({ id: collection.id, libs });

				if (collectionDetail && collectionDetail.assetIds && collectionDetail.assetIds.length > 0) {
					// Check each asset in the collection for music topics
					for (const assetId of collectionDetail.assetIds) {
						try {
							const asset = await getAssetById({ id: assetId, libs });

							if (asset && asset.data && asset.data.topics) {
								const topics = asset.data.topics;

								// Check for music-related topics
								const musicTopics = ['Music', 'Bazar Music', 'ALBUM', 'Cover Art'];
								const hasMusicTopics = musicTopics.some((topic) => topics.includes(topic));

								// Also check for audio content type
								const isAudio = asset.data.contentType && asset.data.contentType.startsWith('audio/');

								if (hasMusicTopics || isAudio) {
									console.log(`🎵 Found music asset: ${asset.data.title}`);
									console.log(`🎵 Topics: ${topics.join(', ')}`);
									console.log(`🎵 Content type: ${asset.data.contentType}`);
									console.log(`🎵 Collection: ${collection.title}`);

									musicCollectionIds.add(collection.id);
									break; // Found music in this collection, move to next collection
								}
							}
						} catch (e) {
							console.error(`Error checking asset ${assetId}:`, e);
							continue;
						}
					}
				}
			} catch (e) {
				console.error(`Error searching collection ${collection.id}:`, e);
				continue;
			}
		}

		// Get the collections that contain music assets
		let musicCollections = Array.from(musicCollectionIds)
			.map((id) => collectionsMap.get(id))
			.filter(Boolean);

		// If we didn't find any, return empty array
		if (musicCollections.length === 0) {
			console.log('🎵 No music collections found by asset topics');
		}

		console.log(
			`🎵 Found ${musicCollections.length} music collections by asset topics:`,
			musicCollections.map((c) => c.title)
		);
		return musicCollections;
	} catch (e: any) {
		console.error('Error in music collections search by asset topics:', e);
		return [];
	}
}

export async function getMusicCollectionsByGraphQL(libs: any): Promise<CollectionType[]> {
	try {
		console.log('🎵 Searching for music assets using GraphQL...');

		// Import the necessary functions
		const { getGQLData } = await import('api');
		const { GATEWAYS, TAGS } = await import('helpers/config');
		const { getTagValue } = await import('helpers/utils');

		// For debugging, let's first try a simple search to see if GraphQL is working
		console.log('🎵 Testing GraphQL connection...');
		try {
			const testResponse = await getGQLData({
				gateway: GATEWAYS.arweave,
				ids: null,
				tagFilters: null,
				owners: null,
				cursor: null,
				paginator: 5, // Just get 5 assets to test
			});
			console.log(`🎵 GraphQL test successful, found ${testResponse?.data?.length || 0} assets`);
		} catch (e) {
			console.error('🎵 GraphQL test failed:', e);
		}

		// Search for assets with music topics using GraphQL
		const musicTopics = ['Music', 'Bazar Music', 'ALBUM', 'Cover Art'];
		const musicCollectionIds = new Set<string>();

		// Search for each music topic
		for (const topic of musicTopics) {
			console.log(`🎵 Searching for assets with topic: ${topic}`);

			try {
				const gqlResponse = await getGQLData({
					gateway: GATEWAYS.arweave,
					ids: null,
					tagFilters: [{ name: 'Topic', values: [topic], match: 'FUZZY_OR' }],
					owners: null,
					cursor: null,
					paginator: 50, // Get up to 50 assets per topic
				});

				if (gqlResponse && gqlResponse.data && gqlResponse.data.length > 0) {
					console.log(`🎵 Found ${gqlResponse.data.length} assets with topic: ${topic}`);

					// Process each asset to get its collection ID directly from tags
					for (const element of gqlResponse.data) {
						try {
							// Get collection ID directly from the asset's tags
							const collectionId = getTagValue(element.node.tags, TAGS.keys.collectionId);
							const assetTitle =
								getTagValue(element.node.tags, TAGS.keys.title) ||
								getTagValue(element.node.tags, TAGS.keys.name) ||
								element.node.id;

							if (collectionId) {
								console.log(`🎵 Asset ${assetTitle} belongs to collection: ${collectionId}`);
								musicCollectionIds.add(collectionId);
							} else {
								console.log(`🎵 Asset ${assetTitle} has no collection ID`);
							}
						} catch (e) {
							console.error(`Error processing asset ${element.node.id}:`, e);
							continue;
						}
					}
				}
			} catch (e) {
				console.error(`Error searching for topic ${topic}:`, e);
				continue;
			}
		}

		// Also search for audio content types
		console.log('🎵 Searching for audio content types...');
		try {
			const audioResponse = await getGQLData({
				gateway: GATEWAYS.arweave,
				ids: null,
				tagFilters: [{ name: 'Content-Type', values: ['audio/mpeg', 'audio/wav', 'audio/ogg'], match: 'FUZZY_OR' }],
				owners: null,
				cursor: null,
				paginator: 50,
			});

			if (audioResponse && audioResponse.data && audioResponse.data.length > 0) {
				console.log(`🎵 Found ${audioResponse.data.length} audio assets`);

				for (const element of audioResponse.data) {
					try {
						// Get collection ID directly from the asset's tags
						const collectionId = getTagValue(element.node.tags, TAGS.keys.collectionId);
						const assetTitle =
							getTagValue(element.node.tags, TAGS.keys.title) ||
							getTagValue(element.node.tags, TAGS.keys.name) ||
							element.node.id;

						if (collectionId) {
							console.log(`🎵 Audio asset ${assetTitle} belongs to collection: ${collectionId}`);
							musicCollectionIds.add(collectionId);
						} else {
							console.log(`🎵 Audio asset ${assetTitle} has no collection ID`);
						}
					} catch (e) {
						console.error(`Error processing audio asset ${element.node.id}:`, e);
						continue;
					}
				}
			}
		} catch (e) {
			console.error('Error searching for audio content types:', e);
		}

		// Get the collections that contain music assets
		if (musicCollectionIds.size === 0) {
			console.log('🎵 No music collections found via GraphQL search');
			return [];
		}

		console.log(`🎵 Found ${musicCollectionIds.size} unique music collection IDs`);

		// Get all collections and filter for the music ones
		const allCollections = await getCollections(null, libs);
		const musicCollections = allCollections.filter((collection) => musicCollectionIds.has(collection.id));

		console.log(
			`🎵 Found ${musicCollections.length} music collections via GraphQL:`,
			musicCollections.map((c) => c.title)
		);
		return musicCollections;
	} catch (e: any) {
		console.error('Error in GraphQL music collections search:', e);
		return [];
	}
}

export async function getMusicCollectionsTest(libs: any): Promise<CollectionType[]> {
	try {
		console.log('🎵 Testing with known music collection...');

		// Get all collections first
		const allCollections = await getCollections(null, libs);

		if (!allCollections || allCollections.length === 0) {
			console.log('🎵 No collections found');
			return [];
		}

		// Return empty array for test function
		console.log('🎵 Test function - returning empty array');
		return [];
	} catch (e: any) {
		console.error('Error in test music collections:', e);
		return [];
	}
}

export async function getMusicCollectionsFromRedux(): Promise<CollectionType[]> {
	try {
		console.log('🎵 Searching for music assets using GraphQL...');

		// Import the necessary functions
		const { getGQLData } = await import('api');
		const { GATEWAYS, TAGS } = await import('helpers/config');
		const { getTagValue } = await import('helpers/utils');

		// Search for assets with music and podcast topics using GraphQL
		// These are the exact values from the JSON array: ["Music","Bazar Music","Cover Art","ALBUM","hip-hop/rap","Mixes","podcast","bazar podcast"]
		const musicAndPodcastTopics = [
			'Music',
			'Bazar Music',
			'Cover Art',
			'ALBUM',
			'hip-hop/rap',
			'Mixes',
			'podcast',
			'bazar podcast',
		];
		const musicCollectionIds = new Set<string>();

		console.log('🎵 Searching for music and podcast assets by Bootloader-Topics values...');

		// Search for each music and podcast topic value within Bootloader-Topics
		for (const topic of musicAndPodcastTopics) {
			console.log(`🎵 Searching for music/podcast assets with Bootloader-Topics containing: ${topic}`);

			try {
				const gqlResponse = await getGQLData({
					gateway: GATEWAYS.arweave,
					ids: null,
					tagFilters: [{ name: 'Bootloader-Topics', values: [topic], match: 'FUZZY_OR' }],
					owners: null,
					cursor: null,
					paginator: 20, // Get up to 20 assets per topic
				});

				if (gqlResponse && gqlResponse.data && gqlResponse.data.length > 0) {
					console.log(
						`🎵 Found ${gqlResponse.data.length} music/podcast assets with Bootloader-Topics containing: ${topic}`
					);

					// Process each asset to get its collection ID directly from tags
					for (const element of gqlResponse.data) {
						try {
							// Get collection ID from Bootloader-CollectionId tag (not Collection-Id)
							const collectionId = getTagValue(element.node.tags, 'Bootloader-CollectionId');
							const assetTitle =
								getTagValue(element.node.tags, 'Bootloader-Name') ||
								getTagValue(element.node.tags, TAGS.keys.title) ||
								getTagValue(element.node.tags, TAGS.keys.name) ||
								element.node.id;

							// Also check the Bootloader-Topics value to confirm it contains music
							const bootloaderTopics = getTagValue(element.node.tags, 'Bootloader-Topics');
							console.log(`🎵 Asset ${assetTitle} Bootloader-Topics: ${bootloaderTopics}`);

							if (collectionId) {
								console.log(`🎵 Asset ${assetTitle} belongs to collection: ${collectionId}`);
								musicCollectionIds.add(collectionId);
							} else {
								console.log(`🎵 Asset ${assetTitle} has no Bootloader-CollectionId`);
							}
						} catch (e) {
							console.error(`Error processing asset ${element.node.id}:`, e);
							continue;
						}
					}
				} else {
					console.log(`🎵 No music/podcast assets found with Bootloader-Topics containing: ${topic}`);
				}
			} catch (e) {
				console.error(`Error searching for music/podcast Bootloader-Topics containing ${topic}:`, e);
				continue;
			}
		}

		// Also search for audio content types as backup
		console.log('🎵 Searching for audio content types...');
		try {
			const audioResponse = await getGQLData({
				gateway: GATEWAYS.arweave,
				ids: null,
				tagFilters: [{ name: 'Content-Type', values: ['audio/mpeg', 'audio/wav', 'audio/ogg'], match: 'FUZZY_OR' }],
				owners: null,
				cursor: null,
				paginator: 20,
			});

			if (audioResponse && audioResponse.data && audioResponse.data.length > 0) {
				console.log(`🎵 Found ${audioResponse.data.length} audio assets`);

				for (const element of audioResponse.data) {
					try {
						// Get collection ID from Bootloader-CollectionId tag
						const collectionId = getTagValue(element.node.tags, 'Bootloader-CollectionId');
						const assetTitle =
							getTagValue(element.node.tags, 'Bootloader-Name') ||
							getTagValue(element.node.tags, TAGS.keys.title) ||
							getTagValue(element.node.tags, TAGS.keys.name) ||
							element.node.id;

						if (collectionId) {
							console.log(`🎵 Audio asset ${assetTitle} belongs to collection: ${collectionId}`);
							musicCollectionIds.add(collectionId);
						} else {
							console.log(`🎵 Audio asset ${assetTitle} has no Bootloader-CollectionId`);
						}
					} catch (e) {
						console.error(`Error processing audio asset ${element.node.id}:`, e);
						continue;
					}
				}
			} else {
				console.log('🎵 No audio assets found');
			}
		} catch (e) {
			console.error('Error searching for audio content types:', e);
		}

		// Get the collections that contain music assets
		if (musicCollectionIds.size === 0) {
			console.log('🎵 No music collections found via GraphQL search');
			return [];
		}

		console.log(`🎵 Found ${musicCollectionIds.size} unique music collection IDs:`, Array.from(musicCollectionIds));

		// Get collections from Redux store and filter for the music ones
		const { store } = await import('store');
		const collectionsReducer = store.getState().collectionsReducer;
		const allCollections = collectionsReducer?.stamped?.collections || [];

		if (allCollections.length === 0) {
			console.log('🎵 No collections found in Redux store');
			return [];
		}

		const musicCollections = allCollections.filter((collection) => musicCollectionIds.has(collection.id));

		console.log(
			`🎵 Found ${musicCollections.length} music collections:`,
			musicCollections.map((c) => c.title)
		);
		return musicCollections;
	} catch (e: any) {
		console.error('Error in GraphQL music collections search:', e);
		return [];
	}
}

export async function getAllMusicCollections(libs: any): Promise<CollectionType[]> {
	try {
		// Check Redux cache first
		const state = store.getState().collectionsReducer;
		const cachedMusic = state?.music;
		const cacheAge = cachedMusic?.lastUpdate ? Date.now() - cachedMusic.lastUpdate : Infinity;
		const cacheDuration = 5 * 60 * 1000; // 5 minutes

		// Temporary: Force cache refresh to debug Crypto Chronicles issue
		const forceRefresh = true; // Set to false to use cache again

		console.log('🎵 Cache check - cachedMusic:', cachedMusic?.collections?.length || 0, 'collections');
		console.log('🎵 Cache age:', cacheAge, 'ms, duration:', cacheDuration, 'ms');
		console.log('🎵 Force refresh:', forceRefresh);

		if (cachedMusic?.collections && cacheAge < cacheDuration && !forceRefresh) {
			console.log('🎵 Using cached music collections:', cachedMusic.collections.length, 'collections');
			cachedMusic.collections.forEach((col: any, i: number) => {
				console.log(`  ${i + 1}. ${col.title} (ID: ${col.id})`);
			});
			return cachedMusic.collections;
		}

		// Import the necessary functions
		const { GATEWAYS } = await import('helpers/config');
		const { getTagValue } = await import('helpers/utils');

		// Set to store unique music collection IDs
		const musicCollectionIds = new Set<string>();

		// Use a more targeted search for Bazar Music assets with cover art

		try {
			// Search for assets that have both Bootloader-CoverArt and Bazar Music topics
			const query = `{
				transactions(
					tags: [
						{ name: "Bootloader-CoverArt" }
					]
					first: 50
					sort: HEIGHT_DESC
				) {
					edges {
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

			// Try different GraphQL endpoints
			const endpoints = [
				'https://arweave.net/graphql',
				'https://arweave-search.goldsky.com/graphql',
				'https://g8way.io/graphql',
			];

			let success = false;

			for (const endpoint of endpoints) {
				try {
					const response = await fetch(endpoint, {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							Accept: 'application/json',
						},
						body: JSON.stringify({ query }),
					});

					if (response.ok) {
						const result = await response.json();

						if (result.data && result.data.transactions && result.data.transactions.edges) {
							const assets = result.data.transactions.edges;

							// Process each asset to get its collection ID
							for (const edge of assets) {
								try {
									const node = edge.node;
									const collectionId = getTagValue(node.tags, 'Bootloader-CollectionId');
									const assetTitle = getTagValue(node.tags, 'Bootloader-Name') || node.id;
									const topicsTag = node.tags.find((tag: any) => tag.name === 'Bootloader-Topics');

									if (collectionId) {
										// Check if this is a music or podcast asset
										let isMusicOrPodcast = false;
										let hasPodcast = false;

										if (topicsTag && topicsTag.value) {
											const topics = topicsTag.value.toLowerCase();

											// Check specifically for Bazar Music and podcast topics
											const hasBazarMusic = topics.includes('bazar music');
											hasPodcast = topics.includes('podcast') || topics.includes('bazar podcast');

											isMusicOrPodcast = hasBazarMusic || hasPodcast;

											// Debug: Log what we're finding
											if (assetTitle.includes('Crypto') || assetTitle.includes('Chronicles')) {
												console.log('🔍 Found potential Crypto Chronicles asset:', assetTitle);
												console.log('  - Collection ID:', collectionId);
												console.log('  - Topics:', topicsTag.value);
												console.log('  - Is music/podcast:', isMusicOrPodcast);
											}
										}

										if (isMusicOrPodcast) {
											musicCollectionIds.add(collectionId);
										}
									}
								} catch (e) {
									console.error(`Error processing asset ${edge.node.id}:`, e);
									continue;
								}
							}

							success = true;
							break; // Success, stop trying other endpoints
						}
					} else {
						const errorText = await response.text();
					}
				} catch (e) {
					continue;
				}
			}

			if (!success) {
				// Fallback to known music assets
				const knownMusicAssetIds = [
					'qN_E5p_dVs5MP8oukTZH25z0yh_BCIVuVCPv6kO7Dqg', // Back Then
				];

				for (const assetId of knownMusicAssetIds) {
					musicCollectionIds.add('3oz9r4M8aT1-wcbKmv5rYixUdWdCKYRmMMmfsqbTgCQ'); // Known collection ID
				}
			}
		} catch (e) {
			console.error('Error in GraphQL search:', e);
			// Fallback to known collection
			musicCollectionIds.add('3oz9r4M8aT1-wcbKmv5rYixUdWdCKYRmMMmfsqbTgCQ');
		}

		// Fetch all the music collections
		const musicCollections: CollectionType[] = [];

		console.log('🎵 Found collection IDs to process:', Array.from(musicCollectionIds));

		for (const collectionId of musicCollectionIds) {
			try {
				console.log('🎵 Fetching collection:', collectionId);

				// Try to get collection data, but don't fail if HyperBEAM is down
				let collection;
				try {
					collection = await libs.getCollection(collectionId);
					console.log(
						'🎵 Successfully fetched collection:',
						collectionId,
						'Title:',
						collection?.title || collection?.name
					);
				} catch (hyperbeamError) {
					console.log('🎵 HyperBEAM failed for collection:', collectionId, 'Error:', hyperbeamError.message);

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

					console.log('🎵 Processing collection:', cleanTitle, '(ID:', collectionId, ')');

					// Filter out test collections
					if (cleanTitle.toLowerCase().includes('test')) {
						console.log('🎵 Skipping test collection:', cleanTitle);
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
					if (
						mappedCollection.title &&
						!mappedCollection.title.includes('Back Then') &&
						!mappedCollection.title.includes('Echoes of Wisdom') &&
						!mappedCollection.title.toLowerCase().includes('test')
					) {
						musicCollections.push(mappedCollection);
						console.log('🎵 Added collection to result:', mappedCollection.title, '(ID:', mappedCollection.id, ')');
					} else {
						console.log('🎵 Skipped collection:', mappedCollection.title, '(Reason: filtered out)');
						if (mappedCollection.title.includes('Back Then')) {
							console.log('  - Reason: Contains "Back Then"');
						}
						if (mappedCollection.title.includes('Echoes of Wisdom')) {
							console.log('  - Reason: Contains "Echoes of Wisdom"');
						}
						if (mappedCollection.title.toLowerCase().includes('test')) {
							console.log('  - Reason: Contains "test"');
						}
					}
				}
			} catch (e) {
				console.error(`Error fetching collection ${collectionId}:`, e);
				continue;
			}
		}

		console.log('🎵 Final music collections result:', musicCollections.length, 'collections');
		musicCollections.forEach((collection, index) => {
			console.log(`  ${index + 1}. ${collection.title} (ID: ${collection.id})`);
		});

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

export async function getMusicCollectionsSimple(): Promise<CollectionType[]> {
	try {
		// Import the store
		const { store } = await import('store');

		// Get collections from Redux store
		const collectionsReducer = store.getState().collectionsReducer;
		const allCollections = collectionsReducer?.stamped?.collections || [];

		if (allCollections.length === 0) {
			return [];
		}

		// Return empty array for simple function
		return [];
	} catch (e: any) {
		console.error('Error getting music collections (simple):', e);
		return [];
	}
}

export async function getMusicCollectionDirect(libs: any): Promise<CollectionType[]> {
	try {
		// We know this collection ID from the test asset
		const knownMusicCollectionId = '3oz9r4M8aT1-wcbKmv5rYixUdWdCKYRmMMmfsqbTgCQ';

		// Use permaweb-libs getCollection method
		const musicCollection = await libs.getCollection(knownMusicCollectionId);

		if (musicCollection) {
			// Map the collection data to the expected format
			const mappedCollection: CollectionType = {
				id: musicCollection.id || knownMusicCollectionId,
				title: musicCollection.title || musicCollection.name || 'Music Collection',
				description: musicCollection.description || '',
				creator: musicCollection.creator || '',
				dateCreated: musicCollection.dateCreated || Date.now(),
				banner: musicCollection.banner || null,
				thumbnail: musicCollection.thumbnail || null,
				activityProcess: musicCollection.activityProcess || null,
			};

			return [mappedCollection];
		} else {
			return [];
		}
	} catch (e: any) {
		console.error('Error fetching music collection directly:', e);
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
	return AO.defaultToken;
}
