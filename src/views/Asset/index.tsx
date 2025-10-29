import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import _ from 'lodash';

import { getAssetById, getAssetOrders } from 'api';

import { Loader } from 'components/atoms/Loader';
import { Portal } from 'components/atoms/Portal';
import { AssetData } from 'components/organisms/AssetData';
import { AO, DOM, HB, TOKEN_REGISTRY, URLS } from 'helpers/config';
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
							const fetchedAsset = await getAssetById({ id: id, libs: permawebProvider.libs });
							setAsset(fetchedAsset);

							if (fetchedAsset !== null) {
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
										if (pair.Orders && Array.isArray(pair.Orders)) {
											const pairOrders = pair.Orders.map((order: any) => ({
												creator: order.Creator || order.creator,
												dateCreated: order.DateCreated || order.dateCreated,
												id: order.Id || order.id,
												originalQuantity: order.OriginalQuantity || order.originalQuantity,
												quantity: order.Quantity || order.quantity,
												token: order.Token || order.token,
												currency: pair.Pair[1], // The token being received
												price: order.Price || order.price || '0', // Ensure price is always set
											}));
											allOrders = allOrders.concat(pairOrders);
										}
									});
								}
							} else {
								const response = await permawebProvider.libs.readState({
									processId: asset.orderbook.id,
									path: 'orderbook',
									fallbackAction: 'Info',
									node: HB.defaultNode,
								});

								if (response?.Orderbook) {
									// Handle both array and single object structures
									const orderbookData = Array.isArray(response.Orderbook) ? response.Orderbook : [response.Orderbook];

									// Process each pair and concatenate orders
									orderbookData.forEach((pair: any) => {
										if (pair && pair.Pair) {
											const pairOrders = getAssetOrders(pair);
											allOrders = allOrders.concat(pairOrders);
										}
									});
								}
							}

							// Sort both arrays before deep comparison to handle order differences
							const sortedCurrent = sortOrders(currentOrders);
							const sortedNew = sortOrders(allOrders);

							// Deep compare current orders with newly fetched orders
							if (!_.isEqual(sortedCurrent, sortedNew)) {
								ordersChanged = true;
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
