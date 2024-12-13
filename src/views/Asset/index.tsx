import React from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import _ from 'lodash';

import { getAssetById, getAssetOrders } from 'api';

import { Loader } from 'components/atoms/Loader';
import { Notification } from 'components/atoms/Notification';
import { Portal } from 'components/atoms/Portal';
import { AssetData } from 'components/organisms/AssetData';
import { DOM, URLS } from 'helpers/config';
import { AssetDetailType, AssetViewType } from 'helpers/types';
import { checkValidAddress } from 'helpers/utils';
import * as windowUtils from 'helpers/window';
import { useLanguageProvider } from 'providers/LanguageProvider';
import { RootState } from 'store';

import { AssetAction } from './AssetAction';
import { AssetInfo } from './AssetInfo';
import { AssetReadActions } from './AssetReadActions';
import * as S from './styles';

export default function Asset() {
	const { id } = useParams();
	const navigate = useNavigate();

	const ucmReducer = useSelector((state: RootState) => state.ucmReducer);

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
							const fetchedAsset = await getAssetById({ id: id });
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
		if (asset && ucmReducer) {
			const updatedOrders = getAssetOrders({ id: asset.data.id });

			const sortedCurrentOrders = _.sortBy(asset.orders, 'id');
			const sortedUpdatedOrders = _.sortBy(updatedOrders, 'id');

			if (!_.isEqual(sortedCurrentOrders, sortedUpdatedOrders)) {
				console.log('Orders are different, updating asset state...');
				setAsset((prev) => ({
					...prev,
					orders: updatedOrders,
				}));
			}
		}
	}, [ucmReducer]);

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
									toggleUpdate={() => setToggleUpdate(!toggleUpdate)}
									toggleViewType={() => setViewType('reading')}
								/>
							</S.TradingActionWrapper>
							{loading && <Notification message={`${language.updatingAsset}...`} type={'success'} callback={null} />}
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
