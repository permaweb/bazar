import React from 'react';
import { useSelector } from 'react-redux';

import { getAllMusicCollections, getAssetByIdGQL, getCollectionById, getCollections } from 'api';

import { ActivityTable } from 'components/organisms/ActivityTable';
import { CollectionsCarousel } from 'components/organisms/CollectionsCarousel';
import { MusicCollectionsCarousel } from 'components/organisms/MusicCollectionsCarousel';
import { MusicPlayer } from 'components/organisms/MusicPlayer';
import { TrendingTokens } from 'components/organisms/TrendingTokens';
import { getTxEndpoint } from 'helpers/endpoints';
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
							const structuredAsset = await getAssetByIdGQL({ id: assetId });

							// If it's an audio asset, preload the actual audio file
							if (structuredAsset?.data?.contentType?.startsWith('audio/')) {
								// Create a hidden audio element to preload
								const audio = new Audio();
								audio.preload = 'metadata'; // Just load metadata for faster response
								// Use the asset ID to construct the Arweave URL
								audio.src = getTxEndpoint(assetId);
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
	const [hasFetchedCollections, setHasFetchedCollections] = React.useState(false);
	const [hasFetchedMusicCollections, setHasFetchedMusicCollections] = React.useState(false);

	const stampedCollections = collectionsReducer?.stamped?.collections;
	const cachedMusicCollections = collectionsReducer?.music?.collections;

	// Local Music Player State (non-persistent)
	const [currentTrack, setCurrentTrack] = React.useState<AssetDetailType | null>(null);
	const [playlist, setPlaylist] = React.useState<AssetDetailType[]>([]);
	const [isPlaying, setIsPlaying] = React.useState<boolean>(false);
	const [currentTime, setCurrentTime] = React.useState<number>(0);
	const [duration, setDuration] = React.useState<number>(0);
	const [volume, setVolume] = React.useState<number>(0.7);

	// Calculate current index in playlist
	const currentIndex = React.useMemo(() => {
		if (!currentTrack || playlist.length === 0) return -1;
		return playlist.findIndex((track) => track.data.id === currentTrack.data.id);
	}, [currentTrack, playlist]);

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

				// Add to playlist if not already there
				setPlaylist((prev) => {
					if (!prev.find((track) => track.data.id === asset.data.id)) {
						return [...prev, asset];
					}
					return prev;
				});
			}
		},
		[currentTrack?.data?.id, isPlaying]
	);

	// Music player control handlers
	const handlePlayPause = () => setIsPlaying(!isPlaying);
	const handleSkipNext = () => {
		if (!currentTrack) {
			setIsPlaying(false);
			return;
		}
		const index = playlist.findIndex((track) => track.data.id === currentTrack.data.id);
		if (index >= 0 && index < playlist.length - 1) {
			setCurrentTrack(playlist[index + 1]);
			setCurrentTime(0);
			setDuration(0);
		} else {
			setIsPlaying(false);
		}
	};
	const handleSkipPrevious = () => {
		if (!currentTrack) {
			setCurrentTime(0);
			return;
		}
		const index = playlist.findIndex((track) => track.data.id === currentTrack.data.id);
		if (index > 0) {
			setCurrentTrack(playlist[index - 1]);
			setCurrentTime(0);
			setDuration(0);
		} else {
			setCurrentTime(0);
		}
	};
	const handleVolumeChange = (newVolume: number) => setVolume(newVolume);
	const handleSeek = (time: number) => setCurrentTime(time);
	const handleDurationChange = (newDuration: number) => setDuration(newDuration);

	React.useEffect(() => {
		if (!permawebProvider.libs || hasFetchedCollections || stampedCollections?.length) {
			if (stampedCollections?.length) {
				setCollections(stampedCollections);
				setCollectionsLoading(false);
				setHasFetchedCollections(true);
			}
			return;
		}

		let cancelled = false;

		(async function () {
			setCollectionsLoading(true);
			try {
				const collectionsFetch: CollectionType[] = await getCollections(null, permawebProvider.libs);
				if (!cancelled && collectionsFetch) {
					setCollections(collectionsFetch);
				}
			} catch (e: any) {
				if (!cancelled) {
					console.error(e.message || language.collectionsFetchFailed);
				}
			} finally {
				if (!cancelled) {
					setCollectionsLoading(false);
					setHasFetchedCollections(true);
				}
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [hasFetchedCollections, permawebProvider.libs, stampedCollections?.length, language.collectionsFetchFailed]);

	React.useEffect(() => {
		(async function () {
			if (!cachedMusicCollections?.length) {
				return;
			}

			const SPAM_ADDRESS = 'DwYZmjS7l6NHwojaH7-LzRBb4RiwjshGQm7-1ApDObw';
			const filteredCachedMusicCollections = cachedMusicCollections.filter(
				(collection: any) => collection.creator !== SPAM_ADDRESS
			);
			setMusicCollections(filteredCachedMusicCollections);
			setMusicCollectionsLoading(false);
		})();
	}, [cachedMusicCollections]);

	React.useEffect(() => {
		if (!permawebProvider.libs || hasFetchedMusicCollections) {
			return;
		}

		if (cachedMusicCollections?.length) {
			setHasFetchedMusicCollections(true);
			return;
		}

		if (musicCollections && musicCollections.length > 0) {
			setHasFetchedMusicCollections(true);
			return;
		}

		let cancelled = false;

		(async function () {
			setMusicCollectionsLoading(true);
			try {
				const musicCollectionsFetch: CollectionType[] = await getAllMusicCollections(permawebProvider.libs);

				if (!cancelled && musicCollectionsFetch && musicCollectionsFetch.length > 0) {
					setMusicCollections(musicCollectionsFetch);
					preloadAudioAssets(musicCollectionsFetch, permawebProvider.libs);
				}
			} catch (e: any) {
				if (!cancelled) {
					console.error('Failed to fetch music collections:', e);
				}
			} finally {
				if (!cancelled) {
					setMusicCollectionsLoading(false);
					setHasFetchedMusicCollections(true);
				}
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [cachedMusicCollections?.length, hasFetchedMusicCollections, musicCollections, permawebProvider.libs]);

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
			<S.TokensWrapper>
				<TrendingTokens />
			</S.TokensWrapper>
			<S.ActivityWrapper>
				<h4>{language.recentActivity}</h4>
				<ActivityTable />
			</S.ActivityWrapper>
			{currentTrack && (
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
					playlist={playlist}
					currentIndex={currentIndex}
				/>
			)}
		</S.Wrapper>
	);
}
