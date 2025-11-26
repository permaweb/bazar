import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import _ from 'lodash';

import { getAssetByIdGQL, getAssetOrders, getAssetStateById } from 'api';

import { Loader } from 'components/atoms/Loader';
import { Portal } from 'components/atoms/Portal';
import { AssetData } from 'components/organisms/AssetData';
import { AO, CUSTOM_ORDERBOOKS, DOM, HB, TOKEN_REGISTRY, URLS } from 'helpers/config';
import { AssetDetailType, AssetViewType } from 'helpers/types';
import { checkValidAddress } from 'helpers/utils';
import * as windowUtils from 'helpers/window';
import { useLanguageProvider } from 'providers/LanguageProvider';
import { usePermawebProvider } from 'providers/PermawebProvider';

import { AssetAction } from './AssetAction';
import { AssetInfo } from './AssetInfo';
import { AssetReadActions } from './AssetReadActions';
import * as S from './styles';

export default function Asset() {
	const { id } = useParams();
	const navigate = useNavigate();

	const permawebProvider = usePermawebProvider();

	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const [asset, setAsset] = React.useState<AssetDetailType | null>(null);
	const [loading, setLoading] = React.useState<boolean>(false);
	const [toggleUpdate, setToggleUpdate] = React.useState<boolean>(false);
	const [errorResponse, setErrorResponse] = React.useState<string | null>(null);
	const [viewType, setViewType] = React.useState<AssetViewType>('trading');
	const [hasLegacyOrderbook, setHasLegacyOrderbook] = React.useState<boolean>(false);
	const [isInitialLoad, setIsInitialLoad] = React.useState<boolean>(true);

	React.useEffect(() => {
		if (viewType === 'reading') {
			windowUtils.hideDocumentBody();
			return () => {
				windowUtils.showDocumentBody();
			};
		} else {
			windowUtils.showDocumentBody();
		}
	}, [viewType]);

	React.useEffect(() => {
		if (asset) setAsset(null);
		setIsInitialLoad(true);
	}, [id]);

	React.useEffect(() => {
		(async function () {
			if (id && checkValidAddress(id)) {
				setLoading(true);
				let tries = 0;
				const maxTries = 10;
				let assetFetched = false;

				const fetchUntilChange = async () => {
					while (!assetFetched && tries < maxTries) {
						try {
							const processState = await getAssetStateById({ id: id });

							if (processState) {
								let assetState: any = {
									name: null,
									ticker: null,
									denomination: null,
									logo: null,
									balances: null,
									transferable: null,
								};

								if (processState.Name || processState.name) {
									assetState.name = processState.Name || processState.name;
								}
								if (processState.Ticker || processState.ticker)
									assetState.ticker = processState.Ticker || processState.ticker;
								if (processState.Denomination || processState.denomination)
									assetState.denomination = processState.Denomination || processState.denomination;
								if (processState.Logo || processState.logo) assetState.logo = processState.Logo || processState.logo;

								// Handle TotalSupply with multiple fallbacks:
								// 1. Check process state (root level, all casings)
								// 2. Check Metadata object (all casings)
								const totalSupply =
									processState.TotalSupply ||
									processState.Totalsupply ||
									processState.totalSupply ||
									processState.Metadata?.TotalSupply ||
									processState.Metadata?.Totalsupply ||
									processState.Metadata?.totalSupply ||
									processState.metadata?.TotalSupply ||
									processState.metadata?.Totalsupply ||
									processState.metadata?.totalSupply;

								if (totalSupply) {
									assetState.totalSupply = totalSupply.toString();
								}

								if (processState.Balances) {
									assetState.balances = Object.fromEntries(
										Object.entries(processState.Balances).filter(([_, value]) => Number(value) !== 0)
									) as any;
								}
								if (processState.Transferable !== undefined) {
									assetState.transferable = processState.Transferable.toString() === 'true';
								} else {
									assetState.transferable = true;
								}

								if (processState.Metadata) {
									assetState.metadata = processState.Metadata;
								}

								let assetOrderbook = null;

								if (CUSTOM_ORDERBOOKS[id]) {
									assetOrderbook = { id: CUSTOM_ORDERBOOKS[id] };
								} else {
									if (processState.Metadata) {
										if (processState.Metadata.OrderbookId) assetOrderbook = { id: processState.Metadata.OrderbookId };
									} else {
										assetOrderbook = { id: AO.ucm, activityId: AO.ucmActivity };
									}
								}

								const fetchedAsset = {
									data: {
										id: id,
										creator: null,
										title: assetState.name || id,
										description: null,
										dateCreated: 0,
										blockHeight: 0,
										renderWith: null,
										license: null,
										udl: null,
										thumbnail: null,
										implementation: null,
										collectionId: processState?.Metadata?.CollectionId || null,
										collectionName: null,
										contentType: null,
										topics: [],
									},
									state: assetState,
									orderbook: assetOrderbook,
								};

								setAsset(fetchedAsset);
								assetFetched = true;
							} else {
								await new Promise((resolve) => setTimeout(resolve, 2000));
								tries++;
							}
						} catch (e: any) {
							setErrorResponse(e.message || language.assetFetchFailed);
							await new Promise((resolve) => setTimeout(resolve, 2000));
							tries++;
						}
					}

					if (!assetFetched) {
						console.warn(`No changes detected after ${maxTries} attempts`);
					}
				};

				await fetchUntilChange();
				setLoading(false);
			} else {
				navigate(URLS.notFound);
			}
		})();
	}, [id]);

	React.useEffect(() => {
		(async function () {
			if (id && checkValidAddress(id) && asset) {
				try {
					const structuredAsset = await getAssetByIdGQL({ id: id });
					if (structuredAsset) {
						setAsset((prevAsset) => ({
							...prevAsset,
							data: {
								...structuredAsset.data,
								title: prevAsset.state?.name || structuredAsset.data.title,
								collectionId: prevAsset.state?.metadata?.CollectionId || structuredAsset.data.collectionId,
							},
						}));
					}
				} catch (e: any) {
					console.error('Failed to fetch GQL data:', e);
				}
			}
		})();
	}, [id, asset?.state]);

	React.useEffect(() => {
		(async function () {
			if (asset?.orderbook?.id) {
				setLoading(true);
				const currentOrders = asset.orderbook.orders || [];
				let tries = 0;
				const maxTries = 50;
				let ordersChanged = false;

				// Helper to sort orders for consistent comparison
				const sortOrders = (orders: any[]) => {
					return _.orderBy(orders, ['id'], ['asc']);
				};

				const fetchUntilOrderbookChanges = async () => {
					while (!ordersChanged && tries < maxTries) {
						try {
							let allOrders: any[] = [];
							let hasLegacy = false;

							if (asset.orderbook.id === AO.ucm) {
								let Orderbook = [];
								for (const id of Object.keys(TOKEN_REGISTRY)) {
									try {
										const response = await permawebProvider.libs.readState({
											processId: asset.orderbook.id,
											path: `orderbooks/${asset.data.id}:${id}`,
										});

										if (response) Orderbook.push(response);
									} catch (e: any) {}
								}

								if (Orderbook) {
									// Find all pairs that include this asset
									const assetPairs = Orderbook.filter((pair: any) => pair.Pair && pair.Pair.includes(asset.data.id));

									// Process all pairs for this asset to get all orders
									assetPairs.forEach((pair: any) => {
										// Helper to map orders with side info and proper currency
										const mapOrders = (orders: any[], side?: string, currency?: string) => {
											return orders.map((order: any) => ({
												creator: order.Creator || order.creator,
												dateCreated: order.DateCreated || order.dateCreated,
												id: order.Id || order.id,
												originalQuantity: order.OriginalQuantity || order.originalQuantity,
												quantity: order.Quantity || order.quantity,
												token: order.Token || order.token,
												currency: currency || pair.Pair[1], // The token being received
												price: order.Price || order.price || '0', // Ensure price is always set
												side: side || order.Side, // Include side information
											}));
										};

										// New structure: Asks and Bids
										if (pair.Asks || pair.Bids) {
											if (pair.Asks && Array.isArray(pair.Asks)) {
												// Ask: Selling Pair[0] for Pair[1] - currency is Pair[1] (what you receive)
												const askOrders = mapOrders(pair.Asks, 'Ask', pair.Pair[1]);
												allOrders = allOrders.concat(askOrders);
											}
											if (pair.Bids && Array.isArray(pair.Bids)) {
												// Bid: Buying Pair[0] with Pair[1] - currency is Pair[0] (what you receive)
												const bidOrders = mapOrders(pair.Bids, 'Bid', pair.Pair[0]);
												allOrders = allOrders.concat(bidOrders);
											}
										}
										// Legacy structure: Orders array (backward compatibility)
										else if (pair.Orders && Array.isArray(pair.Orders)) {
											hasLegacy = true;
											const pairOrders = mapOrders(pair.Orders);
											allOrders = allOrders.concat(pairOrders);
										}
									});
								}
							} else {
								try {
									const response = await permawebProvider.libs.readState({
										processId: asset.orderbook.id,
										path: 'orderbook',
										hydrate: !isInitialLoad,
										fallbackAction: 'Info',
										node: HB.defaultNode,
									});

									if (response?.ActivityProcess) {
										setAsset((prevAsset) => ({
											...prevAsset,
											orderbook: {
												...prevAsset.orderbook,
												activityId: response.ActivityProcess,
											},
										}));
									}

									if (response?.Orderbook) {
										// Handle both array and single object structures
										const orderbookData = Array.isArray(response.Orderbook) ? response.Orderbook : [response.Orderbook];

										// Process each pair and concatenate orders
										orderbookData.forEach((pair: any) => {
											if (pair && pair.Pair) {
												if (pair.Asks && pair.Bids) {
													hasLegacy = false;
												}

												const pairOrders = getAssetOrders(pair);
												allOrders = allOrders.concat(pairOrders);
											}
										});
									} else {
										setLoading(false);
										ordersChanged = true;
										setAsset((prevAsset) => ({
											...prevAsset,
											orderbook: {
												...prevAsset.orderbook,
												orders: allOrders,
											},
										}));
										return;
									}
								} catch (e: any) {
									setLoading(false);
									ordersChanged = true;
									setAsset((prevAsset) => ({
										...prevAsset,
										orderbook: {
											...prevAsset.orderbook,
											orders: allOrders,
										},
									}));
									return;
								}
							}

							if (currentOrders.length <= 0 || allOrders.length <= 0) {
								setLoading(false);
								ordersChanged = true;
								setHasLegacyOrderbook(hasLegacy);
								setAsset((prevAsset) => ({
									...prevAsset,
									orderbook: {
										...prevAsset.orderbook,
										orders: allOrders,
									},
								}));
								return;
							}

							// Sort both arrays before deep comparison to handle order differences
							const sortedCurrent = sortOrders(currentOrders);
							const sortedNew = sortOrders(allOrders);

							// Deep compare current orders with newly fetched orders
							if (!_.isEqual(sortedCurrent, sortedNew)) {
								ordersChanged = true;
								setHasLegacyOrderbook(hasLegacy);
								setAsset((prevAsset) => ({
									...prevAsset,
									orderbook: {
										...prevAsset.orderbook,
										orders: allOrders,
									},
								}));
							} else {
								await new Promise((resolve) => setTimeout(resolve, 2000));
								tries++;
							}
						} catch (e: any) {
							console.error(e);
							await new Promise((resolve) => setTimeout(resolve, 2000));
							tries++;
						}
					}

					if (!ordersChanged && tries >= maxTries) {
						console.warn(`No orderbook changes detected after ${maxTries} attempts`);
						// Initialize with empty orders on timeout
						setAsset((prevAsset) => ({
							...prevAsset,
							orderbook: {
								...prevAsset.orderbook,
								orders: [],
							},
						}));
					}
				};

				await fetchUntilOrderbookChanges();
				setLoading(false);
				setIsInitialLoad(false);
			}
		})();
	}, [asset?.orderbook?.id, toggleUpdate]);

	function getData() {
		if (asset) {
			switch (viewType) {
				case 'trading':
					return (
						<>
							<S.TradingInfoWrapper className={'fade-in'}>
								<AssetInfo asset={asset} />
							</S.TradingInfoWrapper>
							<S.TradingActionWrapper className={'fade-in'}>
								<AssetAction
									asset={asset}
									updating={loading}
									toggleUpdate={() => setToggleUpdate(!toggleUpdate)}
									toggleViewType={() => setViewType('reading')}
									hasLegacyOrderbook={hasLegacyOrderbook}
								/>
							</S.TradingActionWrapper>
						</>
					);
				case 'reading':
					return (
						<Portal node={DOM.overlay}>
							<S.ReadingOverlay className={'fade-in'}>
								<S.ReadingWrapper>
									<S.ReadingActionWrapper className={'fade-in'}>
										<AssetReadActions toggleViewType={() => setViewType('trading')} />
									</S.ReadingActionWrapper>
									<S.ReadingInfoWrapper className={'fade-in'}>
										<AssetData asset={asset} autoLoad />
									</S.ReadingInfoWrapper>
								</S.ReadingWrapper>
							</S.ReadingOverlay>
						</Portal>
					);
			}
		} else {
			if (loading) return <Loader />;
			else if (errorResponse) return <p>{errorResponse}</p>;
			else return null;
		}
	}

	return <S.Wrapper className={'fade-in'}>{getData()}</S.Wrapper>;
}
