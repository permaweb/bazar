import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { getAssetsByIds, getCollectionById } from 'api';

import { Loader } from 'components/atoms/Loader';
import { OwnerLine } from 'components/molecules/OwnerLine';
import { AssetsTable } from 'components/organisms/AssetsTable';
import { DEFAULTS, URLS } from 'helpers/config';
import { getTxEndpoint } from 'helpers/endpoints';
import { AssetDetailType, CollectionDetailType } from 'helpers/types';
import { checkValidAddress } from 'helpers/utils';
import { useLanguageProvider } from 'providers/LanguageProvider';

import * as S from './styles';

export default function Collection() {
	const { id } = useParams();
	const navigate = useNavigate();

	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const [collection, setCollection] = React.useState<CollectionDetailType | null>(null);
	const [assets, setAssets] = React.useState<AssetDetailType[] | null>(null);

	const [loading, setLoading] = React.useState<boolean>(false);
	const [errorResponse, setErrorResponse] = React.useState<string | null>(null);

	React.useEffect(() => {
		(async function () {
			if (id && checkValidAddress(id)) {
				setLoading(true);
				try {
					setCollection(await getCollectionById({ id: id }));
				} catch (e: any) {
					setErrorResponse(e.message || language.collectionFetchFailed);
				}
				setLoading(false);
			} else navigate(URLS.notFound);
		})();
	}, [id]);

	React.useEffect(() => {
		(async function () {
			if (collection && collection.assetIds && collection.assetIds.length) {
				try {
					setAssets(await getAssetsByIds({ ids: collection.assetIds }));
				} catch (e: any) {
					setErrorResponse(e.message || language.assetsFetchFailed);
				}
			}
		})();
	}, [collection]);

	function getData() {
		if (collection) {
			return (
				<>
					<S.CardWrapper backgroundImage={getTxEndpoint(collection.data.banner || DEFAULTS.thumbnail)}>
						<S.InfoWrapper>
							<S.InfoHeader>
								<h2>{collection.data.title}</h2>
							</S.InfoHeader>
							<S.InfoCreator>
								<p>{language.createdBy}</p>
								<OwnerLine
									owner={{
										address: collection.data.creator,
										profile: collection.creatorProfile,
									}}
									callback={null}
								/>
							</S.InfoCreator>
							{collection.data.description && (
								<S.InfoDescription>
									<p>{collection.data.description}</p>
								</S.InfoDescription>
							)}
						</S.InfoWrapper>
					</S.CardWrapper>
					{assets && (
						<S.AssetsWrapper>
							<AssetsTable assets={assets} />
						</S.AssetsWrapper>
					)}
					{errorResponse && <p>{errorResponse}</p>}
				</>
			);
		} else {
			if (loading) return <Loader />;
			else if (errorResponse) return <p>{errorResponse}</p>;
			else return null;
		}
	}

	return <S.Wrapper className={'fade-in'}>{getData()}</S.Wrapper>;
}
