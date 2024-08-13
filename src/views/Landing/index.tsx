import React from 'react';

import { getCollections } from 'api';

import { AssetsTable } from 'components/organisms/AssetsTable';
import { CollectionsCarousel } from 'components/organisms/CollectionsCarousel';
import { OrderCountsTable } from 'components/organisms/OrderCountsTable';
import { TrendingTokens } from 'components/organisms/TrendingTokens';
import { PAGINATORS } from 'helpers/config';
import { CollectionType } from 'helpers/types';
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
				const collectionsFetch: CollectionType[] = await getCollections();
				if (collectionsFetch) setCollections(collectionsFetch.reverse());
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
			<S.TokensWrapper>
				<TrendingTokens />
			</S.TokensWrapper>
			<S.CreatorsWrapper>
				<OrderCountsTable />
			</S.CreatorsWrapper>
			<S.AssetsWrapper>
				<AssetsTable type={'grid'} pageCount={PAGINATORS.landing.assets} />
			</S.AssetsWrapper>
		</S.Wrapper>
	);
}
