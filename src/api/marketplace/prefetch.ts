import { isVisibleAssetId } from 'api/collections/adapter';

import { preloadFungibleAssetView } from 'helpers/asset-page-preload';

import { prefetchAssetState } from './state-store';

export function prefetchAssetPage(processId: string, fungible = false) {
	if (!isVisibleAssetId(processId)) return;
	if (fungible) preloadFungibleAssetView();
	void prefetchAssetState(processId).then((result) => {
		if (!fungible && result && (result.state.totalSupply !== '1' || result.state.denomination > 0)) {
			preloadFungibleAssetView();
		}
	});
}
