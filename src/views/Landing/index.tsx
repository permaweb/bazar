import React from 'react';

import { getCollections } from 'api';

import { AssetsTable } from 'components/organisms/AssetsTable';
import { CollectionsCarousel } from 'components/organisms/CollectionsCarousel';
import { CreatorsTable } from 'components/organisms/CreatorsTable';
import { PAGINATORS } from 'helpers/config';
import { CollectionGQLResponseType, CollectionType } from 'helpers/types';
import { useLanguageProvider } from 'providers/LanguageProvider';

import * as S from './styles';

export default function Landing() {
	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const [collections, setCollections] = React.useState<CollectionType[] | null>(null);
	const [collectionsLoading, setCollectionsLoading] = React.useState<boolean>(false);
	const [collectionsErrorResponse, setCollectionsErrorResponse] = React.useState<string | null>(null);

	React.useEffect(() => {
		(async function () {
			setCollectionsLoading(true);
			try {
				const collectionsFetch: CollectionGQLResponseType = await getCollections({ cursor: null, owner: null });
				setCollections(collectionsFetch.data);
			} catch (e: any) {
				setCollectionsErrorResponse(e.message || language.collectionsFetchFailed);
			}
			setCollectionsLoading(false);
		})();
	}, []);

	return (
		<S.Wrapper className={'fade-in'}>
			<S.CollectionsWrapper>
				<CollectionsCarousel collections={collections} loading={collectionsLoading} />
				{collectionsErrorResponse && <p>{collectionsErrorResponse}</p>}
			</S.CollectionsWrapper>
			<S.CreatorsWrapper>
				<CreatorsTable />
			</S.CreatorsWrapper>
			<S.AssetsWrapper>
				<AssetsTable type={'list'} pageCount={PAGINATORS.landing.assets} />
			</S.AssetsWrapper>
		</S.Wrapper>
	);
}
