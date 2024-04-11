import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { getAssetsByIds, getCollectionById } from 'api';

import { CurrencyLine } from 'components/atoms/CurrencyLine';
import { Loader } from 'components/atoms/Loader';
import { OwnerLine } from 'components/molecules/OwnerLine';
import { AssetsTable } from 'components/organisms/AssetsTable';
import { DEFAULTS, PAGINATORS, URLS } from 'helpers/config';
import { getTxEndpoint } from 'helpers/endpoints';
import { AssetDetailType, CollectionDetailType } from 'helpers/types';
import { checkValidAddress, formatDate, formatPercentage } from 'helpers/utils';
import { useLanguageProvider } from 'providers/LanguageProvider';

import * as S from './styles';

export default function Collection() {
	const { id } = useParams();
	const navigate = useNavigate();

	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const [collection, setCollection] = React.useState<CollectionDetailType | null>(null);
	const [collectionLoading, setCollectionLoading] = React.useState<boolean>(false);
	const [collectionErrorResponse, setCollectionErrorResponse] = React.useState<string | null>(null);

	const [assetCursor, setAssetCursor] = React.useState<string>('0');

	const [assets, setAssets] = React.useState<AssetDetailType[] | null>(null);
	const [assetsLoading, setAssetsLoading] = React.useState<boolean>(false);
	const [assetErrorResponse, setAssetErrorResponse] = React.useState<string | null>(null);

	React.useEffect(() => {
		(async function () {
			if (id && checkValidAddress(id)) {
				setCollectionLoading(true);
				try {
					setCollection(await getCollectionById({ id: id }));
				} catch (e: any) {
					setCollectionErrorResponse(e.message || language.collectionFetchFailed);
				}
				setCollectionLoading(false);
			} else navigate(URLS.notFound);
		})();
	}, [id]);

	React.useEffect(() => {
		(async function () {
			if (collection && collection.assetIdGroups) {
				setAssetsLoading(true);
				try {
					setAssets(await getAssetsByIds({ ids: collection.assetIdGroups[assetCursor] }));
				} catch (e: any) {
					setAssetErrorResponse(e.message || language.assetsFetchFailed);
				}
				setAssetsLoading(false);
			}
		})();
	}, [collection, assetCursor]);

	function getNextAction() {
		if (collection.assetIdGroups && Number(assetCursor) < Object.keys(collection.assetIdGroups).length - 1) {
			return () => setAssetCursor((Number(assetCursor) + 1).toString());
		}
		return null;
	}

	function getPreviousAction() {
		if (collection.assetIdGroups && Number(assetCursor) > 0) {
			return () => setAssetCursor((Number(assetCursor) - 1).toString());
		}
		return null;
	}

	function getData() {
		if (collection) {
			return (
				<>
					<S.CardWrapper
						backgroundImage={getTxEndpoint(collection.data.banner || DEFAULTS.banner)}
						className={'border-wrapper-alt2'}
					>
						<S.InfoWrapper>
							<S.Thumbnail className={'border-wrapper-alt1'}>
								<img src={getTxEndpoint(collection.data.thumbnail || DEFAULTS.thumbnail)} alt={'Thumbnail'} />
							</S.Thumbnail>
							<S.InfoBody>
								<S.InfoBodyTile>
									<S.InfoHeaderFlex2>
										<span>{language.title}</span>
									</S.InfoHeaderFlex2>
									<S.InfoDetailFlex2>
										<span>{collection.data.title}</span>
									</S.InfoDetailFlex2>
								</S.InfoBodyTile>
								{collection.metrics && (
									<S.InfoMetrics>
										<S.InfoBodyTile>
											<S.InfoHeader>
												<span>{language.totalAssets}</span>
											</S.InfoHeader>
											<S.InfoDetail>
												<span>{collection.metrics.assetCount}</span>
											</S.InfoDetail>
										</S.InfoBodyTile>
										<S.InfoBodyTile>
											<S.InfoHeader>
												<span>{language.floorPrice}</span>
											</S.InfoHeader>
											<S.InfoDetail>
												<CurrencyLine
													amount={collection.metrics.floorPrice}
													currency={collection.metrics.defaultCurrency}
												/>
											</S.InfoDetail>
										</S.InfoBodyTile>
										<S.InfoBodyTile>
											<S.InfoHeader>
												<span>{language.percentageListed}</span>
											</S.InfoHeader>
											<S.InfoDetail>
												<span>{formatPercentage(collection.metrics.percentageListed)}</span>
											</S.InfoDetail>
										</S.InfoBodyTile>
									</S.InfoMetrics>
								)}
							</S.InfoBody>
							<S.InfoFooter>
								<S.InfoCreator>
									<p>{language.createdBy}</p>
									<OwnerLine
										owner={{
											address: collection.data.creator,
											profile: collection.creatorProfile,
										}}
										callback={null}
									/>
									<p>{formatDate(collection.data.dateCreated, 'iso')}</p>
								</S.InfoCreator>
								{collection.data.description && (
									<S.InfoDescription>
										<p>{collection.data.description}</p>
									</S.InfoDescription>
								)}
							</S.InfoFooter>
						</S.InfoWrapper>
					</S.CardWrapper>
					<S.AssetsWrapper>
						<AssetsTable
							assets={assets}
							type={'list'}
							nextAction={getNextAction()}
							previousAction={getPreviousAction()}
							currentPage={assetCursor}
							pageCount={PAGINATORS.collection.assets}
							loading={assetsLoading}
						/>
						{assetErrorResponse && <p>{assetErrorResponse}</p>}
					</S.AssetsWrapper>
				</>
			);
		} else {
			if (collectionLoading) return <Loader />;
			else if (collectionErrorResponse) return <p>{collectionErrorResponse}</p>;
			else return null;
		}
	}

	return <S.Wrapper className={'fade-in'}>{getData()}</S.Wrapper>;
}
