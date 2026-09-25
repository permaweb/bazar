import React from 'react';
import { useNavigate } from 'react-router-dom';

import { loadMintActivities, loadMintedAssets, type MintActivity, type MintedAsset } from 'api/mint';

import { useOperationActivity } from 'providers/OperationActivityProvider';

/** Dispatched with the finished mint activity once its asset is live on Bazar. */
const MINT_LIVE_EVENT = 'bazar:mint-live';

export type PendingAssetMint = {
	/** The tracked upload, from the shared activity or this browser's saved uploads. */
	activity: MintActivity | undefined;
	asset: MintedAsset | undefined;
	/** Where the asset lives once its process is applied. */
	finalPath: string;
};

/** Track a submitted mint until its asset is live, then send the route to the asset page. */
export function usePendingAssetMint(collectionId: string, assetId: string): PendingAssetMint {
	const navigate = useNavigate();
	const operationActivity = useOperationActivity();
	const activity =
		operationActivity.mintActivities.find((candidate) => candidate.asset.id === assetId) ??
		loadMintActivities(localStorage).find((candidate) => candidate.asset.id === assetId);
	const finalPath = `/asset/${activity?.collectionId ?? collectionId}/${assetId}`;
	const asset = activity?.asset ?? loadMintedAssets().find((candidate) => candidate.id === assetId);

	React.useEffect(() => {
		const handleMintLive = (event: Event) => {
			if ('detail' in event && (event.detail as MintActivity | undefined)?.asset?.id === assetId) {
				navigate(finalPath, { replace: true });
			}
		};
		window.addEventListener(MINT_LIVE_EVENT, handleMintLive);
		return () => window.removeEventListener(MINT_LIVE_EVENT, handleMintLive);
	}, [assetId, finalPath, navigate]);

	return { activity, asset, finalPath };
}
