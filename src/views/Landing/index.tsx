import React from 'react';
import { useSelector } from 'react-redux';

import { getCollections } from 'api';

// import { ActivityTable } from 'components/organisms/ActivityTable';
// import { AssetsTable } from 'components/organisms/AssetsTable';
import { CollectionsCarousel } from 'components/organisms/CollectionsCarousel';
import { TrendingARNS } from 'components/organisms/TrendingARNS';
// import { OrderCountsTable } from 'components/organisms/OrderCountsTable';
import { TrendingTokens } from 'components/organisms/TrendingTokens';
// import { PAGINATORS } from 'helpers/config';
import { CollectionType } from 'helpers/types';
import { useLanguageProvider } from 'providers/LanguageProvider';
import { RootState } from 'store';

import * as S from './styles';

// TODO
export default function Landing() {
	const collectionsReducer = useSelector((state: RootState) => state.collectionsReducer);

	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const [collections, setCollections] = React.useState<CollectionType[] | null>(null);
	const [collectionsLoading, setCollectionsLoading] = React.useState<boolean>(true);

	React.useEffect(() => {
		(async function () {
			if (!collections) {
				setCollectionsLoading(true);
				try {
					if (collectionsReducer?.stamped?.collections?.length) {
						setCollections(collectionsReducer.stamped.collections);
						setCollectionsLoading(false);
					}

					const collectionsFetch: CollectionType[] = await getCollections(null, true);
					if (collectionsFetch) setCollections(collectionsFetch);
				} catch (e: any) {
					console.error(e.message || language.collectionsFetchFailed);
				}
				setCollectionsLoading(false);
			}
		})();
	}, [collectionsReducer?.stamped]);

	// const startDate = Math.floor(Date.now()) - 1 * 12 * 60 * 60 * 1000;

	return (
		<S.Wrapper className={'fade-in'}>
			<S.CollectionsWrapper>
				<CollectionsCarousel collections={collections} loading={collectionsLoading} />
			</S.CollectionsWrapper>
			<S.TokensWrapper>
				<TrendingTokens />
			</S.TokensWrapper>
			<S.ARNSWrapper>
				<TrendingARNS />
			</S.ARNSWrapper>
			{/* <S.ActivityWrapper>
				<h4>{language.recentActivity}</h4>
				<ActivityTable groupCount={15} startDate={startDate} />
			</S.ActivityWrapper>
			<S.CreatorsWrapper>
				<OrderCountsTable />
			</S.CreatorsWrapper> */}
			{/* <S.AssetsWrapper>
				<AssetsTable type={'grid'} pageCount={PAGINATORS.landing.assets} />
			</S.AssetsWrapper> */}
		</S.Wrapper>
	);
}
