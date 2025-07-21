import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import _ from 'lodash';

import { getAssetById, getAssetOrders, readHandler } from 'api';

import { Loader } from 'components/atoms/Loader';
import { Portal } from 'components/atoms/Portal';
import { AssetData } from 'components/organisms/AssetData';
import { AO, DOM, HB, URLS } from 'helpers/config';
import { AssetDetailType, AssetViewType } from 'helpers/types';
import { checkValidAddress } from 'helpers/utils';
import * as windowUtils from 'helpers/window';
import { useLanguageProvider } from 'providers/LanguageProvider';
import { usePermawebProvider } from 'providers/PermawebProvider';
import { useTokenProvider } from 'providers/TokenProvider';

import { AssetAction } from './AssetAction';
import { AssetInfo } from './AssetInfo';
import { AssetReadActions } from './AssetReadActions';
import * as S from './styles';

export default function Asset() {
	const { id } = useParams();
	const navigate = useNavigate();

	const permawebProvider = usePermawebProvider();
	const tokenProvider = useTokenProvider();

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
				console.log('Fetching asset...');

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
								{ name: 'SwapToken', value: tokenProvider.selectedToken.id },
							],
						});

						if (response?.Orderbook) {
							setAsset((prevAsset) => ({
								...prevAsset,
								orderbook: {
									...prevAsset.orderbook,
									orders: getAssetOrders(response.Orderbook),
								},
							}));
						} else {
							// Initialize with empty orders if no orderbook exists
							setAsset((prevAsset) => ({
								...prevAsset,
								orderbook: {
									...prevAsset.orderbook,
									orders: [],
								},
							}));
						}
					} else {
						const response = await permawebProvider.libs.readState({
							processId: asset.orderbook.id,
							path: 'orderbook',
							fallbackAction: 'Info',
							node: HB.defaultNode,
						});

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
					// Initialize with empty orders on error
					setAsset((prevAsset) => ({
						...prevAsset,
						orderbook: {
							...prevAsset.orderbook,
							orders: [],
						},
					}));
				}
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
