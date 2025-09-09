import React from 'react';
import { useSelector } from 'react-redux';

import { getAllMusicCollections, getAssetById, getCollectionById, getCollections } from 'api';

import { ActivityTable } from 'components/organisms/ActivityTable';
import { CollectionsCarousel } from 'components/organisms/CollectionsCarousel';
import MusicCollectionsCarousel from 'components/organisms/MusicCollectionsCarousel';
import { MusicPlayer } from 'components/organisms/MusicPlayer';
import { AssetDetailType, CollectionType } from 'helpers/types';
import { useLanguageProvider } from 'providers/LanguageProvider';
import { usePermawebProvider } from 'providers/PermawebProvider';
import { RootState } from 'store';

import * as S from './styles';

// Preload audio assets for faster playback
const preloadAudioAssets = async (collections: CollectionType[], libs: any) => {
	try {
		// Preload first few audio assets from each collection
		for (const collection of collections.slice(0, 3)) {
			try {
				const collectionDetail = await getCollectionById({ id: collection.id, libs });

				if (collectionDetail?.assetIds?.length > 0) {
					// Preload first 2 audio assets from each collection
					const audioAssetIds = collectionDetail.assetIds.slice(0, 2);

					for (const assetId of audioAssetIds) {
						try {
							// Fetch asset data to resolve audio URL
							const asset = await getAssetById({ id: assetId, libs });

							// If it's an audio asset, preload the actual audio file
							if (asset?.data?.contentType?.startsWith('audio/')) {
								// Create a hidden audio element to preload
								const audio = new Audio();
								audio.preload = 'metadata'; // Just load metadata for faster response
								// Use the asset ID to construct the Arweave URL
								audio.src = `https://arweave.net/${assetId}`;
								audio.load();
							}
						} catch (e) {
							// Continue if one asset fails
							continue;
						}
					}
				}
			} catch (e) {
				// Continue if collection fails
				continue;
			}
		}
	} catch (e) {
		// Silent fail - preloading is optional
	}
};

export default function Landing() {
	const collectionsReducer = useSelector((state: RootState) => state.collectionsReducer);

	const permawebProvider = usePermawebProvider();

	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const [collections, setCollections] = React.useState<CollectionType[] | null>(null);
	const [collectionsLoading, setCollectionsLoading] = React.useState<boolean>(true);
	const [musicCollections, setMusicCollections] = React.useState<CollectionType[] | null>(null);
	const [musicCollectionsLoading, setMusicCollectionsLoading] = React.useState<boolean>(true);

	// Local Music Player State (non-persistent)
	const [currentTrack, setCurrentTrack] = React.useState<AssetDetailType | null>(null);
	const [isPlaying, setIsPlaying] = React.useState<boolean>(false);
	const [currentTime, setCurrentTime] = React.useState<number>(0);
	const [duration, setDuration] = React.useState<number>(0);
	const [volume, setVolume] = React.useState<number>(0.7);

	// Local play track function - will be passed to MusicCollectionsCarousel
	const handlePlayTrack = React.useCallback(
		(asset: AssetDetailType) => {
			if (currentTrack?.data?.id === asset?.data?.id) {
				// Same track - toggle play/pause
				setIsPlaying(!isPlaying);
			} else {
				// New track - start playing
				setCurrentTrack(asset);
				setIsPlaying(true);
				setCurrentTime(0);
				setDuration(0);
			}
		},
		[currentTrack?.data?.id, isPlaying]
	);

	// Music player control handlers
	const handlePlayPause = () => setIsPlaying(!isPlaying);
	const handleSkipNext = () => setIsPlaying(false);
	const handleSkipPrevious = () => setCurrentTime(0);
	const handleVolumeChange = (newVolume: number) => setVolume(newVolume);
	const handleSeek = (time: number) => setCurrentTime(time);
	const handleDurationChange = (newDuration: number) => setDuration(newDuration);

	React.useEffect(() => {
		(async function () {
			if (!collections) {
				setCollectionsLoading(true);
				try {
					if (collectionsReducer?.stamped?.collections?.length) {
						// Filter cached collections for spam
						const SPAM_ADDRESS = 'DwYZmjS7l6NHwojaH7-LzRBb4RiwjshGQm7-1ApDObw';
						const filteredCachedCollections = collectionsReducer.stamped.collections.filter(
							(collection: any) => collection.creator !== SPAM_ADDRESS
						);
						setCollections(filteredCachedCollections);
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
			// Check Redux cache first for better performance
			const state = collectionsReducer;
			const cachedMusic = state?.music;
			const cacheAge = cachedMusic?.lastUpdate ? Date.now() - cachedMusic.lastUpdate : Infinity;
			const cacheDuration = 5 * 60 * 1000; // 5 minutes

			if (cachedMusic?.collections && cacheAge < cacheDuration) {
				// Filter cached music collections for spam
				const SPAM_ADDRESS = 'DwYZmjS7l6NHwojaH7-LzRBb4RiwjshGQm7-1ApDObw';
				const filteredCachedMusicCollections = cachedMusic.collections.filter(
					(collection: any) => collection.creator !== SPAM_ADDRESS
				);
				setMusicCollections(filteredCachedMusicCollections);
				setMusicCollectionsLoading(false);
				return;
			}

			// Only fetch if we don't have music collections yet
			if (!musicCollections) {
				setMusicCollectionsLoading(true);
				try {
					// Use comprehensive search for all music collections
					let musicCollectionsFetch: CollectionType[] = await getAllMusicCollections(permawebProvider.libs);

					if (musicCollectionsFetch && musicCollectionsFetch.length > 0) {
						setMusicCollections(musicCollectionsFetch);

						// Preload audio assets for faster playback
						preloadAudioAssets(musicCollectionsFetch, permawebProvider.libs);
					}
				} catch (e: any) {
					console.error('Failed to fetch music collections:', e);
				}
				setMusicCollectionsLoading(false);
			}
		})();
	}, [musicCollections, collectionsReducer]); // Depend on both state and Redux cache

	return (
		<S.Wrapper className={'fade-in'}>
			<S.CollectionsWrapper>
				<CollectionsCarousel collections={collections} loading={collectionsLoading} />
			</S.CollectionsWrapper>

			<S.MusicCollectionsWrapper>
				<MusicCollectionsCarousel
					collections={musicCollections}
					loading={musicCollectionsLoading}
					onPlayTrack={handlePlayTrack}
					currentTrack={currentTrack}
					isPlaying={isPlaying}
				/>
			</S.MusicCollectionsWrapper>
			<S.ActivityWrapper>
				<h4>{language.recentActivity}</h4>
				<ActivityTable />
			</S.ActivityWrapper>

			{/* Local Music Player - only shows when a track is selected */}
			{currentTrack && (
				<div
					style={{
						position: 'fixed',
						bottom: 0,
						left: 0,
						right: 0,
						zIndex: 1000,
						backgroundColor: 'white',
						borderTop: '1px solid #e5e5e5',
						boxShadow: '0 -2px 8px rgba(0,0,0,0.1)',
					}}
				>
					<MusicPlayer
						currentTrack={currentTrack}
						isPlaying={isPlaying}
						onPlayPause={handlePlayPause}
						onSkipNext={handleSkipNext}
						onSkipPrevious={handleSkipPrevious}
						onVolumeChange={handleVolumeChange}
						onSeek={handleSeek}
						onDurationChange={handleDurationChange}
						currentTime={currentTime}
						duration={duration}
						volume={volume}
						playlist={currentTrack ? [currentTrack] : []}
						currentIndex={0}
					/>
				</div>
			)}
		</S.Wrapper>
	);
}
