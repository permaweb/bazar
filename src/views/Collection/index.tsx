import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { getAssetsByIds, getCollectionById } from 'api';

import { Loader } from 'components/atoms/Loader';
import { AssetsTable } from 'components/organisms/AssetsTable';
import { CollectionCard } from 'components/organisms/CollectionCard';
import { URLS } from 'helpers/config';
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
			} else navigate(URLS.base); // TODO redirect 404
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

	console.log(assets);

	function getData() {
		if (collection) {
			return (
				<>
					<S.CardWrapper>
						<CollectionCard collection={collection} />
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
