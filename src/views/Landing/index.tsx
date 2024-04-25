import React from 'react';

import { getAssetIdGroups, getAssetsByIds, getCollections } from 'api';

import { AssetsTable } from 'components/organisms/AssetsTable';
import { CollectionsCarousel } from 'components/organisms/CollectionsCarousel';
import { ASSET_SORT_OPTIONS, PAGINATORS, STYLING } from 'helpers/config';
import {
	AssetDetailType,
	AssetSortType,
	CollectionGQLResponseType,
	CollectionType,
	IdGroupType,
	SelectOptionType,
} from 'helpers/types';
import * as windowUtils from 'helpers/window';
import { useLanguageProvider } from 'providers/LanguageProvider';

import * as S from './styles';

export default function Landing() {
	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const [desktop, setDesktop] = React.useState(windowUtils.checkWindowCutoff(parseInt(STYLING.cutoffs.initial)));

	const [collections, setCollections] = React.useState<CollectionType[] | null>(null);
	const [collectionsLoading, setCollectionsLoading] = React.useState<boolean>(false);
	const [collectionsErrorResponse, setCollectionsErrorResponse] = React.useState<string | null>(null);

	const [assetIdGroups, setAssetIdGroups] = React.useState<IdGroupType | null>(null);
	const [assetFilterListings, setAssetFilterListings] = React.useState<boolean>(false);
	const [assetSortType, setAssetSortType] = React.useState<SelectOptionType | null>(ASSET_SORT_OPTIONS[0]);
	const [assetCursor, setAssetCursor] = React.useState<string>('0');

	const [assets, setAssets] = React.useState<AssetDetailType[] | null>(null);
	const [assetsLoading, setAssetsLoading] = React.useState<boolean>(false);
	const [assetErrorResponse, setAssetErrorResponse] = React.useState<string | null>(null);

	React.useEffect(() => {
		(async function () {
			setAssetIdGroups(
				getAssetIdGroups({
					groupCount: PAGINATORS.landing.assets,
					filterListings: assetFilterListings,
					sortType: assetSortType.id as AssetSortType,
				})
			);

			setCollectionsLoading(true);
			try {
				const collectionsFetch: CollectionGQLResponseType = await getCollections({ cursor: null, owner: null });
				setCollections(collectionsFetch.data);
			} catch (e: any) {
				setCollectionsErrorResponse(e.message || language.collectionsFetchFailed);
			}
			setCollectionsLoading(false);
		})();
	}, [assetFilterListings, assetSortType]);

	React.useEffect(() => {
		(async function () {
			if (assetIdGroups) {
				setAssetsLoading(true);
				try {
					setAssets(
						await getAssetsByIds({ ids: assetIdGroups[assetCursor], sortType: assetSortType.id as AssetSortType })
					);
				} catch (e: any) {
					setAssetErrorResponse(e.message || language.assetsFetchFailed);
				}
				setAssetsLoading(false);
			}
		})();
	}, [assetIdGroups, assetCursor, assetSortType]);

	function handleWindowResize() {
		if (windowUtils.checkWindowCutoff(parseInt(STYLING.cutoffs.initial))) {
			setDesktop(true);
		} else {
			setDesktop(false);
		}
	}

	windowUtils.checkWindowResize(handleWindowResize);

	function getPaginationAction(callback: () => void) {
		setAssets(null);
		callback();
	}

	function getNextAction() {
		if (assetIdGroups && Number(assetCursor) < Object.keys(assetIdGroups).length - 1) {
			return () => getPaginationAction(() => setAssetCursor((Number(assetCursor) + 1).toString()));
		}
		return null;
	}

	function getPreviousAction() {
		if (assetIdGroups && Number(assetCursor) > 0) {
			return () => getPaginationAction(() => setAssetCursor((Number(assetCursor) - 1).toString()));
		}
		return null;
	}

	return (
		<S.Wrapper className={'fade-in'}>
			<S.CollectionsWrapper>
				<CollectionsCarousel collections={collections} loading={collectionsLoading} />
				{collectionsErrorResponse && <p>{collectionsErrorResponse}</p>}
			</S.CollectionsWrapper>
			<S.AssetsWrapper>
				<AssetsTable
					assets={assets}
					type={desktop ? 'list' : 'grid'}
					nextAction={getNextAction()}
					previousAction={getPreviousAction()}
					filterListings={assetFilterListings}
					setFilterListings={() => setAssetFilterListings(!assetFilterListings)}
					currentSortType={assetSortType}
					setCurrentSortType={(option: SelectOptionType) => setAssetSortType(option)}
					currentPage={assetCursor}
					pageCount={PAGINATORS.landing.assets}
					loading={assetsLoading}
				/>
				{assetErrorResponse && <p>{assetErrorResponse}</p>}
			</S.AssetsWrapper>
		</S.Wrapper>
	);
}
