import React from 'react';

import { prefetchAssetPage } from 'api/marketplace';

// Binds a link's focus, hover, and touch intent to warming one asset page: its cached live state and, for fungible
// assets, the lazy fungible route. The handler stays stable per asset so memoized rows do not rerender.
export function useAssetPageWarmup(assetId: string, fungible: boolean): () => void {
	return React.useCallback(() => prefetchAssetPage(assetId, fungible), [assetId, fungible]);
}
