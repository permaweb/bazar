import React from 'react';

import { getAssetsByIds, getCollections, getOrderbookAssetIds } from 'api';

import { AssetsTable } from 'components/organisms/AssetsTable';
import { CollectionsCarousel } from 'components/organisms/CollectionsCarousel';
import { PAGINATORS } from 'helpers/config';
import { AssetDetailType, CollectionGQLResponseType, CollectionType, IdGroupType } from 'helpers/types';
import { useLanguageProvider } from 'providers/LanguageProvider';

import * as S from './styles';

export default function Landing() {
	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const [collections, setCollections] = React.useState<CollectionType[] | null>(null);
	const [collectionsLoading, setCollectionsLoading] = React.useState<boolean>(false);
	const [collectionsErrorResponse, setCollectionsErrorResponse] = React.useState<string | null>(null);

	const [assetIdGroups, setAssetIdGroups] = React.useState<IdGroupType | null>(null);
	const [assetCursor, setAssetCursor] = React.useState<string>('0');

	const [assets, setAssets] = React.useState<AssetDetailType[] | null>(null);
	const [assetsLoading, setAssetsLoading] = React.useState<boolean>(false);
	const [assetErrorResponse, setAssetErrorResponse] = React.useState<string | null>(null);

	React.useEffect(() => {
		(async function () {
			setAssetIdGroups(getOrderbookAssetIds({ groupCount: PAGINATORS.landing.assets }));

			setCollectionsLoading(true);
			try {
				const collectionsFetch: CollectionGQLResponseType = await getCollections();
				setCollections(collectionsFetch.data);
			} catch (e: any) {
				setCollectionsErrorResponse(e.message || language.collectionsFetchFailed);
			}
			setCollectionsLoading(false);
		})();
	}, []);

	React.useEffect(() => {
		(async function () {
			if (assetIdGroups) {
				setAssetsLoading(true);
				try {
					setAssets(await getAssetsByIds({ ids: assetIdGroups[assetCursor] }));
				} catch (e: any) {
					setAssetErrorResponse(e.message || language.assetsFetchFailed);
				}
				setAssetsLoading(false);
			}
		})();
	}, [assetIdGroups, assetCursor]);

	function getCollectionData() {
		return (
			<S.CollectionsWrapper>
				<CollectionsCarousel collections={collections} loading={collectionsLoading} />
				{collectionsErrorResponse && <p>{collectionsErrorResponse}</p>}
			</S.CollectionsWrapper>
		);
	}

	function getNextAction() {
		if (assetIdGroups && Number(assetCursor) < Object.keys(assetIdGroups).length - 1) {
			return () => setAssetCursor((Number(assetCursor) + 1).toString());
		}
		return null;
	}

	function getPreviousAction() {
		if (assetIdGroups && Number(assetCursor) > 0) {
			return () => setAssetCursor((Number(assetCursor) - 1).toString());
		}
		return null;
	}

	function getAssetData() {
		return (
			<S.AssetsWrapper>
				<AssetsTable
					assets={assets}
					type={'list'}
					nextAction={getNextAction()}
					previousAction={getPreviousAction()}
					currentPage={assetCursor}
					pageCount={PAGINATORS.landing.assets}
					loading={assetsLoading}
				/>
				{assetErrorResponse && <p>{assetErrorResponse}</p>}
			</S.AssetsWrapper>
		);
	}

	return (
		<S.Wrapper className={'fade-in'}>
			{getCollectionData()}
			{getAssetData()}
		</S.Wrapper>
	);
}
