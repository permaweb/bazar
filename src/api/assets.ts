import { getGQLData, readProcessState } from 'api';

import { GATEWAYS, TAGS } from 'helpers/config';
import { AGQLResponseType, AssetDetailType, AssetStateType, AssetType, GQLNodeResponseType } from 'helpers/types';
import { getTagValue } from 'helpers/utils';

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

			return { ...structuredAsset, state: assetState };
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
				title: getTagValue(element.node.tags, TAGS.keys.title),
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
