import React from 'react';

import { prefetchAssetPage } from 'api/marketplace';

import { useMessages } from 'providers/LanguageProvider';
import { useWallet } from 'providers/WalletProvider';

import { ASSET_DETAIL_MESSAGES } from '../messages';
import type { AssetDetailScreen } from '../model/asset-detail';
import { type UniqueAssetView, uniqueAssetView } from '../model/unique-asset-view';

import { type AssetDetailActivity, useAssetDetailActivity } from './useAssetDetailActivity';
import { type AssetDetailResolutionState, useAssetDetailResolution } from './useAssetDetailResolution';
import { type UniqueAssetOperations, useUniqueAssetOperations } from './useUniqueAssetOperations';

/** Dispatched with the asset id when an operation dialog finishes, so the asset page re-reads live state. */
const ASSET_OPERATION_FINISHED_EVENT = 'bazar:asset-operation-finished';

/** The route's screen; a unique asset carries its page view model. */
export type AssetDetailPage =
	| Exclude<AssetDetailScreen, { kind: 'unique' }>
	| (Extract<AssetDetailScreen, { kind: 'unique' }> & { view: UniqueAssetView });

export type AssetDetailController = Omit<AssetDetailResolutionState, 'screen'> & {
	screen: AssetDetailPage;
	activity: AssetDetailActivity;
	operations: UniqueAssetOperations;
	/** Drop cached state, re-read it, and reload market activity. */
	refreshAsset(): Promise<void>;
	/** Warm another asset's page when the user shows intent to open it. */
	prefetchAsset(assetId: string): void;
};

/** Everything the asset route shows and does: resolution, live state, market activity, and atomic operations. */
export function useAssetDetail(collectionId: string, assetId: string): AssetDetailController {
	const messages = useMessages(ASSET_DETAIL_MESSAGES);
	const wallet = useWallet();
	const resolution = useAssetDetailResolution(collectionId, assetId);
	const activity = useAssetDetailActivity({
		assetId,
		resolvedAssetKey: resolution.resolvedAssetKey,
		state: resolution.live.state,
		walletAddress: wallet.address,
	});
	const retryActivity = activity.retryActivity;
	const refreshLiveState = resolution.live.refresh;
	const refreshAsset = React.useCallback(async () => {
		retryActivity();
		await refreshLiveState();
	}, [refreshLiveState, retryActivity]);

	React.useEffect(() => {
		const handleOperationFinished = (event: Event) => {
			if ('detail' in event && event.detail === assetId) void refreshAsset();
		};
		window.addEventListener(ASSET_OPERATION_FINISHED_EVENT, handleOperationFinished);
		return () => window.removeEventListener(ASSET_OPERATION_FINISHED_EVENT, handleOperationFinished);
	}, [assetId, refreshAsset]);

	const operations = useUniqueAssetOperations({
		assetId,
		collectionId,
		walletAddress: wallet.address,
		verifiedAsset: resolution.verifiedAsset,
		state: resolution.live.state,
		refreshAsset,
	});
	const prefetchAsset = React.useCallback((nextAssetId: string) => {
		prefetchAssetPage(nextAssetId);
	}, []);

	const screen = resolution.screen;
	return {
		...resolution,
		screen:
			screen.kind === 'unique'
				? {
						...screen,
						view: uniqueAssetView({
							asset: screen.asset,
							collection: screen.collection,
							state: screen.state,
							walletAddress: wallet.address,
							activity: activity.activity.events,
							loading: resolution.live.loading,
							error: resolution.live.error,
							operationPhase: operations.activity?.phase ?? null,
							hasUnavailableRecovery: Boolean(operations.unavailableRecovery),
							messages,
						}),
				  }
				: screen,
		activity,
		operations,
		refreshAsset,
		prefetchAsset,
	};
}
