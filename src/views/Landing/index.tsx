import React from 'react';
import { useSelector } from 'react-redux';

import {
	debugCacheStatus,
	getAllMusicCollections,
	getCollections,
	getLatestCollections,
	getMusicCollectionDirect,
	getMusicCollections,
	getMusicCollectionsByAssetTopics,
	getMusicCollectionsByGraphQL,
	getMusicCollectionsEfficient,
	getMusicCollectionsFromExisting,
	getMusicCollectionsFromRedux,
	getMusicCollectionsSimple,
	getMusicCollectionsTest,
	testSpecificAsset,
} from 'api';

import { ActivityTable } from 'components/organisms/ActivityTable';
import { CollectionsCarousel } from 'components/organisms/CollectionsCarousel';
import LatestCollectionsCarousel from 'components/organisms/LatestCollectionsCarousel';
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
	const [latestCollections, setLatestCollections] = React.useState<CollectionType[] | null>(null);
	const [latestCollectionsLoading, setLatestCollectionsLoading] = React.useState<boolean>(true);

	// Debug state changes
	React.useEffect(() => {
		console.log('🔍 Landing Component State Update:');
		console.log('  - Collections:', collections?.length || 0);
		console.log('  - Music Collections:', musicCollections?.length || 0);
		console.log('  - Latest Collections:', latestCollections?.length || 0);
		console.log('  - Collections Loading:', collectionsLoading);
		console.log('  - Music Loading:', musicCollectionsLoading);
		console.log('  - Latest Loading:', latestCollectionsLoading);

		// Debug collection data
		if (musicCollections && musicCollections.length > 0) {
			console.log(
				'🎵 Music Collections Data:',
				musicCollections.map((c) => ({ id: c.id, title: c.title, type: 'collection' }))
			);
		}
		if (latestCollections && latestCollections.length > 0) {
			console.log(
				'🆕 Latest Collections Data:',
				latestCollections.map((c) => ({ id: c.id, title: c.title, type: 'collection' }))
			);
		}

		debugCacheStatus();
	}, [
		collections,
		musicCollections,
		latestCollections,
		collectionsLoading,
		musicCollectionsLoading,
		latestCollectionsLoading,
	]);

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

	React.useEffect(() => {
		(async function () {
			// Only fetch if we don't have music collections yet
			if (!musicCollections) {
				console.log('🎵 Starting music collections fetch...');
				setMusicCollectionsLoading(true);
				try {
					console.log('🎵 Testing specific asset first...');
					await testSpecificAsset();

					// Use comprehensive search for all music collections
					console.log('🎵 Using comprehensive music collections search...');
					let musicCollectionsFetch: CollectionType[] = await getAllMusicCollections(permawebProvider.libs);

					// If comprehensive search fails, fall back to direct fetch
					if (!musicCollectionsFetch || musicCollectionsFetch.length === 0) {
						console.log('🎵 Comprehensive search failed, trying direct fetch...');
						musicCollectionsFetch = await getMusicCollectionDirect(permawebProvider.libs);
					}

					// If direct fetch fails, fall back to simple approach
					if (!musicCollectionsFetch || musicCollectionsFetch.length === 0) {
						console.log('🎵 Direct fetch failed, trying simple approach...');
						musicCollectionsFetch = await getMusicCollectionsSimple();
					}

					if (musicCollectionsFetch && musicCollectionsFetch.length > 0) {
						console.log(
							`🎵 Setting ${musicCollectionsFetch.length} music collections:`,
							musicCollectionsFetch.map((c) => c.title)
						);
						setMusicCollections(musicCollectionsFetch);
					} else {
						console.log('🎵 No music collections found');
					}
				} catch (e: any) {
					console.error('Failed to fetch music collections:', e);
				}
				setMusicCollectionsLoading(false);
			} else {
				console.log('🎵 Music collections already loaded, count:', musicCollections.length);
			}
		})();
	}, [musicCollections]); // Only depend on musicCollections state

	React.useEffect(() => {
		(async function () {
			// Only fetch if we don't have latest collections yet
			if (!latestCollections) {
				console.log('🆕 Starting latest collections fetch...');
				setLatestCollectionsLoading(true);
				try {
					console.log('🆕 Fetching latest collections...');
					const latestCollectionsFetch: CollectionType[] = await getLatestCollections(permawebProvider.libs);

					if (latestCollectionsFetch && latestCollectionsFetch.length > 0) {
						console.log(
							`🆕 Setting ${latestCollectionsFetch.length} latest collections:`,
							latestCollectionsFetch.map((c) => c.title)
						);
						setLatestCollections(latestCollectionsFetch);
					} else {
						console.log('🆕 No latest collections found');
					}
				} catch (e: any) {
					console.error('Failed to fetch latest collections:', e);
				}
				setLatestCollectionsLoading(false);
			} else {
				console.log('🆕 Latest collections already loaded, count:', latestCollections.length);
			}
		})();
	}, [latestCollections]); // Only depend on latestCollections state

	return (
		<S.Wrapper className={'fade-in'}>
			{/* Debug button - remove in production */}
			<div style={{ position: 'fixed', top: '10px', right: '10px', zIndex: 1000 }}>
				<button
					onClick={() => {
						console.log('🔍 Manual cache debug triggered');
						debugCacheStatus();
						console.log('🔍 Current state:', {
							collections: collections?.length || 0,
							musicCollections: musicCollections?.length || 0,
							latestCollections: latestCollections?.length || 0,
						});
					}}
					style={{
						background: '#007bff',
						color: 'white',
						border: 'none',
						padding: '5px 10px',
						borderRadius: '4px',
						cursor: 'pointer',
						fontSize: '12px',
					}}
				>
					Debug Cache
				</button>
			</div>

			<S.CollectionsWrapper>
				<CollectionsCarousel collections={collections} loading={collectionsLoading} />
			</S.CollectionsWrapper>
			<S.LatestCollectionsWrapper>
				<LatestCollectionsCarousel collections={latestCollections} loading={latestCollectionsLoading} />
			</S.LatestCollectionsWrapper>
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
