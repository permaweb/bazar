import { getCurrentProfile, getGQLData } from 'api';

import { GATEWAYS, TAGS } from 'helpers/config';
import { getTxEndpoint } from 'helpers/endpoints';
import {
	CollectionDetailType,
	CollectionGQLResponseType,
	CollectionManifestType,
	CollectionType,
	DefaultGQLResponseType,
	GQLNodeResponseType,
} from 'helpers/types';
import { formatAddress, getTagValue } from 'helpers/utils';

export async function getCollections(): Promise<CollectionGQLResponseType> {
	try {
		let collections: CollectionType[] = [];
		let count: number = 0;
		let nextCursor: string | null = null;
		let previousCursor: string | null = null;

		const gqlResponse = await getGQLData({
			gateway: GATEWAYS.arweave,
			ids: null,
			tagFilters: [
				{
					name: TAGS.keys.dataProtocol,
					values: [TAGS.values.collection],
				},
			],
			owners: null,
			cursor: null,
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
			gateway: GATEWAYS.arweave,
			ids: [args.id],
			tagFilters: null,
			owners: null,
			cursor: null,
		});

		if (gqlResponse && gqlResponse.data.length) {
			const structuredCollection = structureCollections(gqlResponse)[0];
			const creatorProfile = await getCurrentProfile({ address: structuredCollection.data.creator });

			let assetIds: string[] = [];
			try {
				const collectionFetch = await fetch(getTxEndpoint(args.id));
				const collectionManifest: CollectionManifestType = await collectionFetch.json();
				if (collectionManifest && collectionManifest.items) assetIds = collectionManifest.items;
			} catch (e: any) {
				console.error(e);
			}

			const collectionDetail = { ...structuredCollection, assetIds: assetIds, creatorProfile: creatorProfile };
			return collectionDetail;
		}

		return null;
	} catch (e: any) {
		throw new Error(e.message || 'Failed to fetch collection');
	}
}

export function structureCollections(gqlResponse: DefaultGQLResponseType): CollectionType[] {
	const structuredCollections: CollectionType[] = [];

	gqlResponse.data.forEach((element: GQLNodeResponseType) => {
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
	});

	return structuredCollections;
}
