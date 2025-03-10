import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import _ from 'lodash';

import { getAssetById, getAssetOrders, readHandler } from 'api';

import { Loader } from 'components/atoms/Loader';
import { Portal } from 'components/atoms/Portal';
import { AssetData } from 'components/organisms/AssetData';
import { AO, DOM, URLS } from 'helpers/config';
import { AssetDetailType, AssetViewType } from 'helpers/types';
import { checkValidAddress } from 'helpers/utils';
import * as windowUtils from 'helpers/window';
import { useLanguageProvider } from 'providers/LanguageProvider';

import { AssetAction } from './AssetAction';
import { AssetInfo } from './AssetInfo';
import { AssetReadActions } from './AssetReadActions';
import * as S from './styles';

export default function Asset() {
	const { id } = useParams();
	const navigate = useNavigate();

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
							const fetchedAsset = await getAssetById({ id });
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
	}, [id, toggleUpdate]);

	React.useEffect(() => {
		(async function () {
			if (asset?.orderbook?.id) {
				setLoading(true);
				try {
					if (asset.orderbook.id === AO.ucm) {
						const response = await readHandler({
							processId: asset.orderbook.id,
							action: 'Get-Orderbook-By-Pair',
							tags: [
								{ name: 'DominantToken', value: asset.data.id },
								{ name: 'SwapToken', value: AO.defaultToken },
							],
						});

						if (response) {
							setAsset((prevAsset) => ({
								...prevAsset,
								orderbook: {
									...prevAsset.orderbook,
									orders: response?.Orderbook ? getAssetOrders(response.Orderbook) : [],
								},
							}));
						} else {
							setAsset((prevAsset) => ({
								...prevAsset,
								orderbook: null,
							}));
						}
					} else {
						const response = await readHandler({
							processId: asset.orderbook.id,
							action: 'Info',
						});

						console.log(response);

						setAsset((prevAsset) => ({
							...prevAsset,
							orderbook: {
								...prevAsset.orderbook,
								activityId: response?.ActivityProcess,
								orders: getAssetOrders(response?.Orderbook?.[0]),
							},
						}));
					}
				} catch (e: any) {
					console.error(e);
				}
				setLoading(false);
			}
		})();
	}, [asset?.orderbook?.id, toggleUpdate]);

	console.log(asset);

	// TODO
	// React.useEffect(() => {
	// 	if (asset && ucmReducer) {
	// 		const updatedOrders = getAssetOrders({ id: asset.data.id });

	// 		const sortedCurrentOrders = _.sortBy(asset.orderbook?.orders, 'id');
	// 		const sortedUpdatedOrders = _.sortBy(updatedOrders, 'id');

	// 		if (!_.isEqual(sortedCurrentOrders, sortedUpdatedOrders)) {
	// 			console.log('Orders are different, updating asset state...');
	// 			setAsset((prev) => ({
	// 				...prev,
	// 				orders: updatedOrders,
	// 			}));
	// 		}
	// 	}
	// }, [ucmReducer]);

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
