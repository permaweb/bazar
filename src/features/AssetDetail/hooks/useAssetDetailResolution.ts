import React from 'react';

import { type AssetSummary, type Collection, loadAssetShellSnapshot, storeAssetShellSnapshot } from 'api/collections';
import { loadBazarAtomicAssetById } from 'api/discovery';

import { toAppError } from 'helpers/app-error';
import { asyncData, type AsyncState, IDLE } from 'helpers/async-state';
import { scheduleIdleTask } from 'helpers/idle';
import { useMessages } from 'providers/LanguageProvider';
import { useMarketProvider } from 'providers/MarketProvider';

import { ASSET_DETAIL_MESSAGES } from '../messages';
import {
	assetDetailErrorMessage,
	assetDetailHasIndexedLookup,
	type AssetDetailScreen,
	assetDetailScreen,
	assetDetailSources,
	assetStateRecoveryUrl,
	type IndexedAtomicAsset,
	resolveAssetDetail,
} from '../model/asset-detail';
import { loadFungibleAssetView } from '../model/fungible-asset-view';

import { type AssetDetailLiveState, useAssetDetailLiveState } from './useAssetDetailLiveState';

export type AssetDetailResolutionState = {
	screen: AssetDetailScreen;
	live: AssetDetailLiveState;
	/** The catalogue collection the route names, when the market index has it. */
	indexedCollection: Collection | undefined;
	indexedAsset: AssetSummary | undefined;
	/** The asset the page may act on: a verified member of its collection. */
	verifiedAsset: AssetSummary | null | undefined;
	/** The resolved asset's id, or null while the route has no asset to present. */
	resolvedAssetKey: string | null;
	/** Reload through Bazar's own AO peers when the embedding wallet's peers cannot serve live state. */
	openStateRecovery: (() => void) | null;
};

/**
 * Resolve the asset route: the market catalogue, a cached shell, the Bazar atomic-asset index, and live AO state
 * combine into the screen to show. Verified assets are cached as shells for the next visit, and the fungible view
 * chunk is warmed as soon as the route looks like a token.
 */
export function useAssetDetailResolution(collectionId: string, assetId: string): AssetDetailResolutionState {
	const messages = useMessages(ASSET_DETAIL_MESSAGES);
	const market = useMarketProvider();
	const cachedAsset = React.useMemo(
		() => loadAssetShellSnapshot(window.localStorage, assetId),
		// Hidden-asset policy is known once market visibility is ready; re-read the shell then.
		[assetId, market.visibilityReady]
	);
	const [indexedLookup, setIndexedLookup] = React.useState<{
		assetId: string;
		result: AsyncState<IndexedAtomicAsset | null>;
	}>({ assetId, result: IDLE });

	// Visibility readiness changes which assets the index may return, so the lookup repeats once it is known.
	React.useEffect(() => {
		if (!assetDetailHasIndexedLookup(assetId, collectionId)) return;
		const controller = new AbortController();
		void loadBazarAtomicAssetById(assetId, { signal: controller.signal }).then(
			(result) => {
				if (!controller.signal.aborted)
					setIndexedLookup({ assetId, result: { status: 'success', data: result } });
			},
			(cause) => {
				if (!controller.signal.aborted) {
					setIndexedLookup({
						assetId,
						result: { status: 'error', error: toAppError(cause, 'index-unavailable') },
					});
				}
			}
		);
		return () => controller.abort();
	}, [assetId, collectionId, market.visibilityReady]);

	const indexedAtomic = indexedLookup.assetId === assetId ? asyncData(indexedLookup.result) ?? null : null;
	const rememberSearchAssets = market.rememberSearchAssets;
	// An asset reached directly stays searchable afterwards, without any catalogue-wide fetch.
	React.useEffect(() => {
		if (indexedAtomic) rememberSearchAssets([indexedAtomic]);
	}, [indexedAtomic, rememberSearchAssets]);

	const sources = assetDetailSources({
		assetId,
		collectionId,
		collections: market.collections,
		cachedAsset,
		indexedAtomic,
	});
	const indexedCollectionKind = sources.indexedCollection?.kind;

	React.useEffect(() => {
		if (collectionId === 'fungible-tokens' || indexedCollectionKind === 'tokens') void loadFungibleAssetView();
	}, [collectionId, indexedCollectionKind]);

	const live = useAssetDetailLiveState({
		assetId,
		canResolve: sources.canResolveAsset,
		visibilityReady: market.visibilityReady,
	});
	const resolution = resolveAssetDetail(sources, {
		assetId,
		state: live.state,
		verifiedCollectionIds: market.verifiedCollectionIds,
	});
	const detailError = assetDetailErrorMessage(
		live.error,
		resolution.shellAsset,
		Boolean(sources.indexedAtomic),
		messages
	);
	const verifiedAsset = resolution.verifiedAsset;

	React.useEffect(() => {
		if (!verifiedAsset) return;
		return scheduleIdleTask(() => storeAssetShellSnapshot(window.localStorage, verifiedAsset), 500);
	}, [verifiedAsset]);

	const recoveryUrl = assetStateRecoveryUrl(live.error, window.location);
	return {
		screen: assetDetailScreen({
			market,
			directAtomicRoute: sources.directAtomicRoute,
			resolution,
			live,
			detailError,
			messages,
		}),
		live,
		indexedCollection: sources.indexedCollection,
		indexedAsset: sources.indexedAsset,
		verifiedAsset,
		resolvedAssetKey: resolution.resolvedAsset ? resolution.resolvedAsset.id : null,
		openStateRecovery: recoveryUrl ? () => window.location.assign(recoveryUrl) : null,
	};
}
