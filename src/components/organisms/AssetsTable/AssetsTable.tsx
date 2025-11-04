import React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { getAssetIdGroups, getAssetsByIds } from 'api';

import * as GS from 'app/styles';
import { Button } from 'components/atoms/Button';
import { CurrencyLine } from 'components/atoms/CurrencyLine';
import { IconButton } from 'components/atoms/IconButton';
import { Notification } from 'components/atoms/Notification';
import { Select } from 'components/atoms/Select';
import { ASSET_SORT_OPTIONS, ASSETS, PAGINATORS, STYLING, URLS } from 'helpers/config';
import { AssetDetailType, AssetSortType, IdGroupType, NotificationType, SelectOptionType } from 'helpers/types';
import { isFirefox, sortOrders } from 'helpers/utils';
import * as windowUtils from 'helpers/window';
import { useAppProvider } from 'providers/AppProvider';
import { useLanguageProvider } from 'providers/LanguageProvider';
import { usePermawebProvider } from 'providers/PermawebProvider';

import { PlayButton } from '../../atoms/PlayButton';
import { AssetData } from '../AssetData';
import { MusicPlayer } from '../MusicPlayer';
import { Stamps } from '../Stamps';

import * as S from './styles';
import { IProps } from './types';

export default function AssetsTable(props: IProps) {
	const [currentTrack, setCurrentTrack] = React.useState<AssetDetailType | null>(null);
	const [isPlaying, setIsPlaying] = React.useState<boolean>(false);
	const [currentTime, setCurrentTime] = React.useState<number>(0);
	const [duration, setDuration] = React.useState<number>(0);
	const [volume, setVolume] = React.useState<number>(0.7);
	const [currentIndex, setCurrentIndex] = React.useState<number>(-1);

	const handlePlayTrack = (asset: AssetDetailType, index: number) => {
		if (currentTrack?.data.id === asset.data.id) {
			// Same track - toggle play/pause
			setIsPlaying(!isPlaying);
		} else {
			// New track - start playing
			setCurrentTrack(asset);
			setCurrentIndex(index);
			setIsPlaying(true);
			setCurrentTime(0);
		}
	};

	const handlePlayPause = () => {
		setIsPlaying(!isPlaying);
	};

	const handleSkipNext = () => {
		if (assets && currentIndex < assets.length - 1) {
			const nextIndex = currentIndex + 1;
			setCurrentTrack(assets[nextIndex]);
			setCurrentIndex(nextIndex);
			setIsPlaying(true);
			setCurrentTime(0);
		}
	};

	const handleSkipPrevious = () => {
		if (assets && currentIndex > 0) {
			const prevIndex = currentIndex - 1;
			setCurrentTrack(assets[prevIndex]);
			setCurrentIndex(prevIndex);
			setIsPlaying(true);
			setCurrentTime(0);
		}
	};

	const handleVolumeChange = (newVolume: number) => {
		setVolume(newVolume);
	};

	const handleSeek = (newTime: number) => {
		setCurrentTime(newTime);
	};

	const handleDurationChange = (newDuration: number) => {
		setDuration(newDuration);
	};
	const { address } = useParams();
	const navigate = useNavigate();

	const appProvider = useAppProvider();
	const permawebProvider = usePermawebProvider();

	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const scrollRef = React.useRef(null);

	const [assetIdGroups, setAssetIdGroups] = React.useState<IdGroupType | null>(null);
	const [assetFilterListings, setAssetFilterListings] = React.useState<boolean>(false);
	const [assetSortType, setAssetSortType] = React.useState<SelectOptionType | null>(ASSET_SORT_OPTIONS[0]);
	const [assetCursor, setAssetCursor] = React.useState<string>('0');

	const [assets, setAssets] = React.useState<AssetDetailType[] | null>(null);
	const [assetsLoading, setAssetsLoading] = React.useState<boolean>(true);
	const [assetErrorResponse, setAssetErrorResponse] = React.useState<string | null>(null);

	const [viewType, setViewType] = React.useState<'list' | 'grid' | null>(null);
	const [desktop, setDesktop] = React.useState(windowUtils.checkWindowCutoff(parseInt(STYLING.cutoffs.initial)));
	const [scrolling, setScrolling] = React.useState<boolean>(false);

	// const [profileLoading, setProfileLoading] = React.useState<boolean>(false);
	const [profileResponse, setProfileResponse] = React.useState<NotificationType | null>(null);

	function handleWindowResize() {
		if (windowUtils.checkWindowCutoff(parseInt(STYLING.cutoffs.initial))) {
			setDesktop(true);
		} else {
			setDesktop(false);
		}
	}

	windowUtils.checkWindowResize(handleWindowResize);

	React.useEffect(() => {
		if (appProvider.stamps.completed) {
			if (props.ids?.length <= 0) {
				setAssets([]);
				setAssetsLoading(false);
			} else {
				if (!props.loadingIds) {
					setAssetIdGroups(
						getAssetIdGroups({
							ids: props.ids || null,
							groupCount: props.pageCount || PAGINATORS.default,
							filterListings: assetFilterListings,
							sortType: assetSortType.id as AssetSortType,
						})
					);
				}
			}
		}
	}, [assetFilterListings, assetSortType, props.ids, props.loadingIds, appProvider.stamps.completed]);

	React.useEffect(() => {
		(async function () {
			if (assetIdGroups && Object.keys(assetIdGroups).length > 0) {
				setAssetsLoading(true);

				try {
					setAssets(
						await getAssetsByIds({ ids: assetIdGroups[assetCursor], sortType: assetSortType.id as AssetSortType })
					);
				} catch (e: any) {
					setAssetErrorResponse(e.message || language.assetsFetchFailed);
				}

				setAssetsLoading(false);
			}
		})();
	}, [assetIdGroups, assetCursor, assetSortType, appProvider.stamps.completed]);

	React.useEffect(() => {
		if (!desktop) setViewType('grid');
		else setViewType(props.type);
	}, [props.type, desktop]);

	const getPaginationAction = (callback: () => void) => {
		setAssets(null);
		callback();
	};

	const previousAction = React.useMemo(() => {
		return assetIdGroups && Number(assetCursor) > 0
			? () => getPaginationAction(() => setAssetCursor((Number(assetCursor) - 1).toString()))
			: null;
	}, [assetIdGroups, assetCursor]);

	const nextAction = React.useMemo(() => {
		return assetIdGroups && Number(assetCursor) < Object.keys(assetIdGroups).length - 1
			? () => getPaginationAction(() => setAssetCursor((Number(assetCursor) + 1).toString()))
			: null;
	}, [assetIdGroups, assetCursor]);

	const handlePaginationAction = (type: 'next' | 'previous', useScroll: boolean) => {
		const action = type === 'next' ? nextAction : previousAction;
		if (action) {
			action();
			setTimeout(() => {
				if (scrollRef.current) {
					if (useScroll) setScrolling(true);

					const scrollOptions = isFirefox() ? {} : { behavior: 'smooth' };
					scrollRef.current.scrollIntoView(scrollOptions);
					if (useScroll) {
						setTimeout(() => {
							setScrolling(false);
						}, 750);
					}
				}
			}, 1);
		}
	};

	function getAssetIndexDisplay(assetIndex: number, sectionIndex: number, sectionLength: number) {
		let index = assetIndex + 1;
		if (sectionIndex > 0) index += sectionLength;
		if (assets && assetCursor && props.pageCount) {
			index += Number(assetCursor) * props.pageCount;
		}
		return index;
	}

	const handleAssetSortType = React.useCallback((option: SelectOptionType) => {
		setAssetIdGroups(null);
		setAssets(null);
		setAssetsLoading(true);
		setAssetSortType(option);
	}, []);

	const toggleFilterListings = React.useCallback(() => {
		setAssetFilterListings((prev) => !prev);
	}, []);

	function getActionDisabled() {
		if (!assets || !assets.length) return true;
		if (assetsLoading) return true;
		if (assets && assets.length) {
			return assets.every((asset: AssetDetailType) =>
				asset.orderbook?.orders ? asset.orderbook?.orders.length <= 0 : true
			);
		}
	}

	function getListing(asset: AssetDetailType) {
		const listingsMap = props.currentListings?.[asset.data.id];
		if (listingsMap && Object.keys(listingsMap).length > 0) {
			const entries = Object.entries(listingsMap) as [string, { quantity: string; floorPrice: string }][];

			const [bestCurrency, bestEntry] = entries.reduce(
				([minCur, minEnt], [cur, ent]) =>
					BigInt(ent.floorPrice) < BigInt(minEnt.floorPrice) ? [cur, ent] : [minCur, minEnt],
				entries[0]
			);

			return <CurrencyLine amount={bestEntry.floorPrice} currency={bestCurrency} />;
		}

		const orders = asset.orderbook?.orders ?? [];
		if (orders.length > 0) {
			const sorted = sortOrders(orders, assetSortType.id as AssetSortType);
			if (sorted.length > 0) {
				return <CurrencyLine amount={sorted[0].price || '0'} currency={sorted[0].currency} />;
			}
		}

		return <S.NoListings>{language.noListings}</S.NoListings>;
	}

	function getSectionHeader() {
		return (
			<S.AssetsListSectionHeader>
				<span>{language.asset}</span>
				<span>{language.listing}</span>
			</S.AssetsListSectionHeader>
		);
	}

	// PFP
	// async function handleProfileActionPress(e: any, asset: AssetDetailType) {
	// 	if (permawebProvider.profile && permawebProvider.profile.id && asset.data && asset.data.id) {
	// 		e.preventDefault();
	// 		e.stopPropagation();

	// 		setProfileLoading(true);
	// 		try {
	// 			const data: any = {
	// 				DisplayName: permawebProvider.profile.displayName,
	// 				UserName: permawebProvider.profile.username,
	// 				Description: permawebProvider.profile.description,
	// 				CoverImage: permawebProvider.profile.banner,
	// 				ProfileImage: asset.data.id,
	// 			};

	// 			let updateResponse = await messageResult({
	// 				processId: permawebProvider.profile.id,
	// 				action: 'Update-Profile',
	// 				tags: null,
	// 				data: data,
	// 				wallet: arProvider.wallet,
	// 			});
	// 			if (updateResponse && updateResponse['Profile-Success']) {
	// 				arProvider.setToggleProfileUpdate(!arProvider.toggleProfileUpdate);
	// 				setProfileResponse({
	// 					message: `${language.profileUpdated}!`,
	// 					status: 'success',
	// 				});
	// 			} else {
	// 				setProfileResponse({
	// 					message: language.errorUpdatingProfile,
	// 					status: 'warning',
	// 				});
	// 			}
	// 		} catch (e: any) {
	// 			console.error(e);
	// 			setProfileResponse({
	// 				message: language.errorUpdatingProfile,
	// 				status: 'warning',
	// 			});
	// 		}
	// 		setProfileLoading(false);
	// 	}
	// }

	function getData() {
		if ((assetsLoading || props.loadingIds) && viewType) {
			let Wrapper: any;
			let Element: any;

			const keys = Array.from({ length: props.pageCount || PAGINATORS.default }, (_, i) => i + 1);
			switch (viewType) {
				case 'list':
					Wrapper = S.AssetsListWrapper;
					Element = S.AssetsListSectionElement;
					break;
				case 'grid':
					Wrapper = S.AssetsGridWrapper;
					Element = S.AssetGridDataWrapper;
					break;
			}

			const elements = keys.map((index) => (
				<Element key={index} className={'fade-in border-wrapper-alt1'} disabled={true} />
			));

			if (viewType === 'list') {
				const splitElements = [
					elements.slice(0, Math.ceil((props.pageCount || PAGINATORS.default) / 2)),
					elements.slice(Math.ceil((props.pageCount || PAGINATORS.default) / 2)),
				];
				return (
					<S.AssetsListWrapper>
						<S.AssetsListSection>
							{getSectionHeader()}
							<S.AssetsListSectionElements>{splitElements[0]}</S.AssetsListSectionElements>
						</S.AssetsListSection>
						<S.AssetsListSection>
							{getSectionHeader()}
							<S.AssetsListSectionElements>{splitElements[1]}</S.AssetsListSectionElements>
						</S.AssetsListSection>
					</S.AssetsListWrapper>
				);
			}

			return <Wrapper>{elements}</Wrapper>;
		}
		if (assets) {
			if (assets.length) {
				switch (viewType) {
					case 'list':
						const splitSections = [
							assets.slice(0, Math.ceil(assets.length / 2)),
							assets.slice(Math.ceil(assets.length / 2)),
						];
						return (
							<S.AssetsListWrapper>
								{splitSections.map((section: AssetDetailType[], index: number) => {
									let sectionIndex = index;
									return (
										<S.AssetsListSection key={index}>
											{getSectionHeader()}
											<S.AssetsListSectionElements>
												{section.map((asset: AssetDetailType, index: number) => {
													const redirect = `${URLS.asset}${asset.data.id}`;
													const isAudioFile = asset.data.contentType && asset.data.contentType.includes('audio/');
													const isCurrentTrack = currentTrack?.data.id === asset.data.id;
													const globalIndex = sectionIndex * splitSections[0].length + index;

													return (
														<S.AssetsListSectionElement
															key={index}
															className={'border-wrapper-alt2'}
															onClick={() => navigate(redirect)}
															disabled={false}
														>
															<S.FlexElement>
																<S.Index>
																	<p>{getAssetIndexDisplay(index, sectionIndex, splitSections[0].length)}</p>
																</S.Index>
																<S.Thumbnail>
																	<AssetData asset={asset} scrolling={scrolling} preview />

																	{/* Play button overlay for audio files in list view */}
																	{isAudioFile && (
																		<PlayButton
																			onClick={() => handlePlayTrack(asset, globalIndex)}
																			isPlaying={isCurrentTrack && isPlaying}
																			size="small"
																		/>
																	)}
																</S.Thumbnail>
																<S.Title>
																	<p>{asset.data.title}</p>
																</S.Title>
															</S.FlexElement>
															{!props.noListings && (
																<S.FlexElement>
																	<S.Listings>{getListing(asset)}</S.Listings>
																</S.FlexElement>
															)}
														</S.AssetsListSectionElement>
													);
												})}
											</S.AssetsListSectionElements>
										</S.AssetsListSection>
									);
								})}
							</S.AssetsListWrapper>
						);
					case 'grid':
						return (
							<>
								<S.AssetsGridWrapper>
									{assets.map((asset: AssetDetailType, index: number) => {
										const redirect = `${URLS.asset}${asset.data.id}`;
										const isAudioFile = asset.data.contentType && asset.data.contentType.includes('audio/');
										const isCurrentTrack = currentTrack?.data.id === asset.data.id;

										return (
											<S.AssetGridElement key={index} className={'fade-in'}>
												<S.AssetGridDataWrapper disabled={false}>
													<AssetData asset={asset} scrolling={scrolling} preview />

													{/* Link wrapper for non-play button areas */}
													<Link
														to={redirect}
														style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1 }}
													>
														<div style={{ width: '100%', height: '100%' }} />
													</Link>

													{/* Play button overlay for audio files - must be above link */}
													{isAudioFile && (
														<PlayButton
															onClick={() => handlePlayTrack(asset, index)}
															isPlaying={isCurrentTrack && isPlaying}
														/>
													)}

													{/* {props.setProfileAction &&
													permawebProvider.profile &&
													permawebProvider.profile.id &&
													permawebProvider.profile.id === address &&
													asset.data.contentType &&
													asset.data.contentType.includes('image') ? (
														<S.AssetGridDataActionWrapper>
															<Stamps
																txId={asset.data.id}
																title={asset.data.title || asset.data.description}
																asButton
																noAutoFetch
															/>
														</S.AssetGridDataActionWrapper>
													) : (
														<S.AssetGridDataActionWrapper>
															<Stamps
																txId={asset.data.id}
																title={asset.data.title || asset.data.description}
																asButton
																noAutoFetch
															/>
														</S.AssetGridDataActionWrapper>
													)} */}
												</S.AssetGridDataWrapper>
												<S.AssetGridBottomWrapper>
													<S.AssetGridInfoWrapper>
														<Link to={redirect}>
															<S.Title>
																<p>{asset.data.title}</p>
															</S.Title>
														</Link>
														<S.Description>
															<p>{asset.data.description || asset.data.title}</p>
														</S.Description>
														{!props.noListings && <S.Listings>{getListing(asset)}</S.Listings>}
													</S.AssetGridInfoWrapper>
												</S.AssetGridBottomWrapper>
											</S.AssetGridElement>
										);
									})}
								</S.AssetsGridWrapper>
								{profileResponse && (
									<Notification
										message={profileResponse.message}
										type={profileResponse.status}
										callback={() => setProfileResponse(null)}
									/>
								)}
							</>
						);
				}
			} else {
				return (
					<GS.FullMessageWrapper className={'fade-in border-wrapper-alt2'}>
						<p>{language.noAssetsFound}</p>
					</GS.FullMessageWrapper>
				);
			}
		}
	}

	return (
		<>
			<S.Wrapper className={'fade-in'} ref={scrollRef}>
				<S.Header>
					<S.HeaderMain>
						<h4>{`${language.assets}${props.ids && props.ids.length ? ` (${props.ids.length})` : ''}`}</h4>
						<S.HeaderActions>
							<Button
								type={'primary'}
								label={language.activeListings}
								handlePress={toggleFilterListings}
								disabled={getActionDisabled()}
								active={assetFilterListings}
								icon={assetFilterListings ? ASSETS.close : null}
								className={'filter-listings'}
							/>
							<S.SelectWrapper>
								<Select
									label={null}
									activeOption={assetSortType}
									setActiveOption={(option: SelectOptionType) => handleAssetSortType(option)}
									options={ASSET_SORT_OPTIONS.map((option: SelectOptionType) => option)}
									disabled={getActionDisabled()}
								/>
							</S.SelectWrapper>
							{desktop && (
								<S.ViewTypeWrapper className={'border-wrapper-alt1'}>
									<IconButton
										type={'alt1'}
										src={ASSETS.grid}
										handlePress={() => setViewType('grid')}
										disabled={viewType === 'grid'}
										dimensions={{
											wrapper: 32.5,
											icon: 17.5,
										}}
										active={viewType === 'grid'}
										tooltip={'Grid view'}
										useBottomToolTip
										className={'start-action'}
									/>
									<IconButton
										type={'alt1'}
										src={ASSETS.list}
										handlePress={() => setViewType('list')}
										disabled={viewType === 'list'}
										dimensions={{
											wrapper: 32.5,
											icon: 17.5,
										}}
										active={viewType === 'list'}
										tooltip={'List view'}
										useBottomToolTip
										className={'end-action'}
									/>
								</S.ViewTypeWrapper>
							)}
							<S.HeaderPaginator>
								<IconButton
									type={'alt1'}
									src={ASSETS.arrow}
									handlePress={() => handlePaginationAction('previous', true)}
									disabled={!assets || !previousAction}
									dimensions={{
										wrapper: 30,
										icon: 17.5,
									}}
									tooltip={language.previous}
									useBottomToolTip
									className={'table-previous'}
								/>
								<IconButton
									type={'alt1'}
									src={ASSETS.arrow}
									handlePress={() => handlePaginationAction('next', true)}
									disabled={!assets || !nextAction}
									dimensions={{
										wrapper: 30,
										icon: 17.5,
									}}
									tooltip={language.next}
									useBottomToolTip
									className={'table-next'}
								/>
							</S.HeaderPaginator>
						</S.HeaderActions>
					</S.HeaderMain>
				</S.Header>
				{getData()}
				<S.Footer>
					<Button
						type={'primary'}
						label={language.previous}
						handlePress={() => handlePaginationAction('previous', true)}
						disabled={!assets || !previousAction}
					/>
					<Button
						type={'primary'}
						label={language.next}
						handlePress={() => handlePaginationAction('next', true)}
						disabled={!assets || !nextAction}
					/>
				</S.Footer>
				{assetErrorResponse && <p>{assetErrorResponse}</p>}
			</S.Wrapper>

			{/* Global Music Player */}
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
				playlist={assets || []}
				currentIndex={currentIndex}
			/>
		</>
	);
}
