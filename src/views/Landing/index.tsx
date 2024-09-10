import React from 'react';

import { getCollections } from 'api';

import { ActivityTable } from 'components/organisms/ActivityTable';
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

	const startDate = Math.floor(Date.now()) - 3 * 24 * 60 * 60 * 1000;

	return (
		<S.Wrapper className={'fade-in'}>
			<S.CollectionsWrapper>
				<CollectionsCarousel collections={collections} loading={collectionsLoading} />
				{collectionsErrorResponse && <p>{collectionsErrorResponse}</p>}
			</S.CollectionsWrapper>
			<S.TokensWrapper>
				<TrendingTokens />
			</S.TokensWrapper>
			<S.ActivityWrapper>
				<h4>{language.recentActivity}</h4>
				<ActivityTable groupCount={15} startDate={startDate} />
			</S.ActivityWrapper>
			<S.CreatorsWrapper>
				<OrderCountsTable />
			</S.CreatorsWrapper>
			<S.AssetsWrapper>
				<AssetsTable type={'grid'} pageCount={PAGINATORS.landing.assets} />
			</S.AssetsWrapper>
		</S.Wrapper>
	);
}
