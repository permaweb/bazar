import React from 'react';
import { useSelector } from 'react-redux';

import { getCollections } from 'api';

import { ActivityTable } from 'components/organisms/ActivityTable';
import { CollectionsCarousel } from 'components/organisms/CollectionsCarousel';
import { CollectionType } from 'helpers/types';
import { useLanguageProvider } from 'providers/LanguageProvider';
import { usePermawebProvider } from 'providers/PermawebProvider';
import { RootState } from 'store';

import * as S from './styles';

export default function Landing() {
	const collectionsReducer = useSelector((state: RootState) => state.collectionsReducer);

	const permawebProvider = usePermawebProvider();

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

					const collectionsFetch: CollectionType[] = await getCollections(null, permawebProvider.libs);
					if (collectionsFetch) setCollections(collectionsFetch);
				} catch (e: any) {
					console.error(e.message || language.collectionsFetchFailed);
				}
				setCollectionsLoading(false);
			}
		})();
	}, [collectionsReducer?.stamped]);

	return (
		<S.Wrapper className={'fade-in'}>
			<S.CollectionsWrapper>
				<CollectionsCarousel collections={collections} loading={collectionsLoading} />
			</S.CollectionsWrapper>
			<S.ActivityWrapper>
				<h4>{language.recentActivity}</h4>
				<ActivityTable />
			</S.ActivityWrapper>
		</S.Wrapper>
	);
}
