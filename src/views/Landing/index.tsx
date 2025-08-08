import React from 'react';
import { useSelector } from 'react-redux';

import { getAllMusicCollections, getCollections, getMusicCollectionDirect, getMusicCollectionsSimple } from 'api';

import { ActivityTable } from 'components/organisms/ActivityTable';
import { CollectionsCarousel } from 'components/organisms/CollectionsCarousel';
import MusicCollectionsCarousel from 'components/organisms/MusicCollectionsCarousel';
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
	const [musicCollections, setMusicCollections] = React.useState<CollectionType[] | null>(null);
	const [musicCollectionsLoading, setMusicCollectionsLoading] = React.useState<boolean>(true);

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

	// State to track if we've already attempted to fetch music collections
	const [musicFetchAttempted, setMusicFetchAttempted] = React.useState(false);

	React.useEffect(() => {
		(async function () {
			// Skip if we already have music collections or have attempted to fetch
			if (musicCollections || musicFetchAttempted) {
				return;
			}

			// Check Redux cache first
			const cachedMusic = collectionsReducer?.music;
			const cacheAge = cachedMusic?.lastUpdate ? Date.now() - cachedMusic.lastUpdate : Infinity;
			const cacheDuration = 5 * 60 * 1000; // 5 minutes

			// Use cache if it's fresh
			if (cachedMusic?.collections && cacheAge < cacheDuration) {
				console.log('🎵 Using cached music collections:', cachedMusic.collections.length);
				setMusicCollections(cachedMusic.collections);
				setMusicCollectionsLoading(false);
				setMusicFetchAttempted(true);
				return;
			}

			// Mark as attempted and start loading
			setMusicFetchAttempted(true);
			setMusicCollectionsLoading(true);
			console.log('🎵 Starting music collections fetch...');

			try {
				// Use comprehensive search for all music collections
				let musicCollectionsFetch: CollectionType[] = await getAllMusicCollections(permawebProvider.libs);

				// If comprehensive search fails, fall back to direct fetch
				if (!musicCollectionsFetch || musicCollectionsFetch.length === 0) {
					musicCollectionsFetch = await getMusicCollectionDirect(permawebProvider.libs);
				}

				// If direct fetch fails, fall back to simple approach
				if (!musicCollectionsFetch || musicCollectionsFetch.length === 0) {
					musicCollectionsFetch = await getMusicCollectionsSimple();
				}

				if (musicCollectionsFetch && musicCollectionsFetch.length > 0) {
					console.log('🎵 Successfully fetched music collections:', musicCollectionsFetch.length);
					setMusicCollections(musicCollectionsFetch);
				} else {
					console.log('🎵 No music collections found');
				}
			} catch (e: any) {
				console.error('Failed to fetch music collections:', e);
			}
			setMusicCollectionsLoading(false);
		})();
	}, [musicCollections, musicFetchAttempted, collectionsReducer?.music, permawebProvider.libs]);

	return (
		<S.Wrapper className={'fade-in'}>
			<S.CollectionsWrapper>
				<CollectionsCarousel collections={collections} loading={collectionsLoading} />
			</S.CollectionsWrapper>

			<S.MusicCollectionsWrapper>
				<MusicCollectionsCarousel collections={musicCollections} loading={musicCollectionsLoading} />
			</S.MusicCollectionsWrapper>
			<S.ActivityWrapper>
				<h4>{language.recentActivity}</h4>
				<ActivityTable />
			</S.ActivityWrapper>
		</S.Wrapper>
	);
}
