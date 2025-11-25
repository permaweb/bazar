import React from 'react';
import { useSelector } from 'react-redux';

import { getAllMusicCollections, getAssetByIdGQL, getAssetStateById, getCollectionById, getCollections } from 'api';

import { ActivityTable } from 'components/organisms/ActivityTable';
import { CollectionsCarousel } from 'components/organisms/CollectionsCarousel';
import { MusicCollectionsCarousel } from 'components/organisms/MusicCollectionsCarousel';
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
			<div style={{ display: 'flex', justifyContent: 'center', margin: '24px 0' }}>
				<a
					href="/#/campaign-3"
					style={{
						background: '#222',
						color: '#fff',
						padding: '16px 32px',
						borderRadius: '8px',
						fontWeight: 'bold',
						fontSize: '1.2rem',
						textDecoration: 'none',
						boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
					}}
				>
					Glasseaters Atomic Asset Campaign
				</a>
			</div>
			<S.CollectionsWrapper>
				<CollectionsCarousel collections={collections} loading={collectionsLoading} />
			</S.CollectionsWrapper>
			<S.TokensWrapper>
				<TrendingTokens />
			</S.TokensWrapper>
			{/* <S.MusicCollectionsWrapper>
				<MusicCollectionsCarousel
					collections={musicCollections}
					loading={musicCollectionsLoading}
					onPlayTrack={handlePlayTrack}
					currentTrack={currentTrack}
					isPlaying={isPlaying}
				/>
			</S.MusicCollectionsWrapper> */}
			<S.ActivityWrapper>
				<h4>{language.recentActivity}</h4>
				<ActivityTable />
			</S.ActivityWrapper>
		</S.Wrapper>
	);
}
