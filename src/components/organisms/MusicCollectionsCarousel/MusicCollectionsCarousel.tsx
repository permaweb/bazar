import React from 'react';
import Carousel from 'react-multi-carousel';
import { Link } from 'react-router-dom';
import { ReactSVG } from 'react-svg';

import { getAssetById, getCollectionById } from 'api';

import { PlayButton } from 'components/atoms/PlayButton';
import { ASSETS, DEFAULTS, URLS } from 'helpers/config';
import { getTxEndpoint } from 'helpers/endpoints';
import { AssetDetailType, CollectionType } from 'helpers/types';
import { formatDate } from 'helpers/utils';
import { useLanguageProvider } from 'providers/LanguageProvider';
import { usePermawebProvider } from 'providers/PermawebProvider';

import 'react-multi-carousel/lib/styles.css';

import * as S from './styles';
import { IProps } from './types';

export default function MusicCollectionsCarousel(props: IProps) {
	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];
	const permawebProvider = usePermawebProvider();

	const [nextSlideClicked, setNextSlideClicked] = React.useState<boolean>(false);
	const [firstClick, setFirstClick] = React.useState<boolean>(false);
	const [loadingTracks, setLoadingTracks] = React.useState<Set<string>>(new Set());

	// Cache for collection details to reduce API calls
	const [collectionsCache, setCollectionsCache] = React.useState<Map<string, any>>(new Map());

	// Function to handle play button click - optimized version
	const handlePlayCollection = async (e: React.MouseEvent, collection: CollectionType) => {
		e.preventDefault();
		e.stopPropagation();

		if (!props.onPlayTrack) return;

		const collectionId = collection.id;
		setLoadingTracks((prev) => new Set(prev).add(collectionId));

		try {
			// Check cache first to avoid unnecessary API calls
			let collectionDetail = collectionsCache.get(collectionId);

			if (!collectionDetail) {
				// Only fetch if not cached
				collectionDetail = await getCollectionById({ id: collectionId, libs: permawebProvider.libs });
				if (collectionDetail) {
					setCollectionsCache((prev) => new Map(prev).set(collectionId, collectionDetail));
				}
			}

			if (collectionDetail && collectionDetail.assetIds && collectionDetail.assetIds.length > 0) {
				// Check only first few assets to reduce delay
				const assetsToCheck = collectionDetail.assetIds.slice(0, 3); // Check only first 3 assets

				for (const assetId of assetsToCheck) {
					try {
						const asset = await getAssetById({ id: assetId, libs: permawebProvider.libs });

						if (asset && asset.data && asset.data.contentType && asset.data.contentType.startsWith('audio/')) {
							// Found an audio asset, play it
							props.onPlayTrack(asset);
							break;
						}
					} catch (assetError) {
						console.error(`Error fetching asset ${assetId}:`, assetError);
						continue;
					}
				}
			}
		} catch (error) {
			console.error(`Error playing collection ${collectionId}:`, error);
		} finally {
			setLoadingTracks((prev) => {
				const newSet = new Set(prev);
				newSet.delete(collectionId);
				return newSet;
			});
		}
	};

	const responsive = {
		desktopInitial: {
			breakpoint: { max: 3000, min: 1325 },
			items: 3, // Changed from 4 to 3 to show all collections
			partialVisibilityGutter: 10,
		},
		desktopSecondary: {
			breakpoint: { max: 1325, min: 1100 },
			items: 3,
		},
		tablet: {
			breakpoint: { max: 1100, min: 700 },
			items: 2,
		},
		mobile: {
			breakpoint: { max: 700, min: 0 },
			items: 1,
		},
	};

	const triggerResize = () => {
		window.dispatchEvent(new Event('resize'));
	};

	const handleAfterChange = () => {
		if (!nextSlideClicked) setNextSlideClicked(true);
		if (!firstClick) {
			triggerResize();
			setFirstClick(true);
		}
	};

	return (
		<S.Wrapper className={'fade-in'}>
			<S.Header>
				<h4>Music/Casts</h4>
			</S.Header>
			<S.CollectionsWrapper previousDisabled={!nextSlideClicked}>
				{(props.collections || props.loading) && (
					<Carousel
						key={`music-carousel-${props.collections?.length || 0}-${props.loading}`}
						responsive={responsive}
						renderButtonGroupOutside={true}
						draggable={false}
						swipeable={true}
						arrows={!props.loading}
						infinite={!props.loading}
						removeArrowOnDeviceType={['tablet', 'mobile']}
						customTransition={'transform 500ms ease'}
						partialVisible
						autoPlay={!props.loading}
						autoPlaySpeed={5000}
						afterChange={handleAfterChange}
					>
						{props.collections &&
							props.collections.map((collection: CollectionType, index: number) => {
								const isCurrentlyPlaying = props.currentTrack && props.isPlaying;
								const isLoadingTrack = loadingTracks.has(collection.id);

								return (
									<S.CollectionWrapper
										key={collection.id}
										className={'fade-in border-wrapper-alt2'}
										backgroundImage={getTxEndpoint(collection.thumbnail || DEFAULTS.thumbnail)}
										disabled={false}
									>
										{/* Centered Play Button overlay like in collection page */}
										{props.onPlayTrack && !isLoadingTrack && (
											<PlayButton onClick={(e) => handlePlayCollection(e, collection)} isPlaying={false} />
										)}

										{/* Loading spinner for when searching for tracks */}
										{isLoadingTrack && (
											<div
												style={{
													position: 'absolute',
													top: '50%',
													left: '50%',
													transform: 'translate(-50%, -50%)',
													zIndex: 20,
												}}
											>
												<S.LoadingSpinner />
											</div>
										)}

										<Link to={URLS.collectionAssets(collection.id)}>
											<S.InfoWrapper>
												<S.InfoTile>
													<S.InfoDetail>
														<span>{collection.title}</span>
													</S.InfoDetail>
													<S.InfoDetailAlt>
														<span>{`${language.createdOn} ${formatDate(collection.dateCreated, 'epoch')}`}</span>
													</S.InfoDetailAlt>
												</S.InfoTile>
											</S.InfoWrapper>
										</Link>
									</S.CollectionWrapper>
								);
							})}
						{props.loading &&
							Array.from({ length: 5 }, (_, i) => i + 1).map((index) => (
								<S.CollectionWrapper
									key={`loading-${index}`}
									className={'fade-in border-wrapper-alt1'}
									backgroundImage={null}
									disabled={true}
								/>
							))}
					</Carousel>
				)}
			</S.CollectionsWrapper>
		</S.Wrapper>
	);
}
