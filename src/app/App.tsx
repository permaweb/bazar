import React, { lazy, Suspense } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { ReactSVG } from 'react-svg';

import { readHandler, stamps } from 'api';

import { Loader } from 'components/atoms/Loader';
import { Modal } from 'components/molecules/Modal';
import { Banner } from 'components/organisms/Banner';
import { AO, ASSETS, DOM, FLAGS, URLS } from 'helpers/config';
import { getTxEndpoint } from 'helpers/endpoints';
import { Footer } from 'navigation/footer';
import { Header } from 'navigation/Header';
import { useArweaveProvider } from 'providers/ArweaveProvider';
import { useLocationProvider } from 'providers/LocationProvider';
import { RootState } from 'store';
import * as currencyActions from 'store/currencies/actions';
import * as stampsActions from 'store/stamps/actions';
import { getCampaignBackground } from 'views/Campaign';

import * as S from './styles';

const Routes = lazy(() =>
	import(`../routes/Routes.tsx` as any).then((module) => ({
		default: module.default,
	}))
);

export default function App() {
	const dispatch = useDispatch();

	const ucmReducer = useSelector((state: RootState) => state.ucmReducer);
	const currenciesReducer = useSelector((state: RootState) => state.currenciesReducer);
	const stampsReducer = useSelector((state: RootState) => state.stampsReducer);

	const arProvider = useArweaveProvider();
	const locationProvider = useLocationProvider();

	const [showCampaign, setShowCampaign] = React.useState<boolean>(false);

	React.useEffect(() => {
		const campaignShown = localStorage.getItem('campaignShown');
		if (locationProvider.country !== 'US' && !campaignShown) {
			setShowCampaign(true);
			localStorage.setItem('campaignShown', 'true');
		} else {
			setShowCampaign(false);
		}
	}, [locationProvider.country]);

	React.useEffect(() => {
		(async function () {
			try {
				if (!currenciesReducer) {
					const defaultTokenState = await readHandler({
						processId: AO.defaultToken,
						action: 'Info',
					});
					const pixlState = await readHandler({
						processId: AO.pixl,
						action: 'Info',
					});

					dispatch(
						currencyActions.setCurrencies({
							[AO.defaultToken]: {
								...defaultTokenState,
							},
							[AO.pixl]: {
								...pixlState,
							},
						})
					);
				}
			} catch (e: any) {
				console.error(e);
			}
		})();
	}, [currenciesReducer]);

	React.useEffect(() => {
		(async function () {
			if (ucmReducer) {
				try {
					const orderbookIds =
						ucmReducer && ucmReducer.Orderbook && ucmReducer.Orderbook.length > 0
							? ucmReducer.Orderbook.map((p: any) => (p.Pair.length > 0 ? p.Pair[0] : null)).filter(
									(p: any) => p !== null
							  )
							: [];

					const updatedStampCounts = await stamps.getStamps({ ids: orderbookIds });

					const updatedStamps = {};
					if (updatedStampCounts) {
						for (const tx of Object.keys(updatedStampCounts)) {
							updatedStamps[tx] = {
								...(stampsReducer?.[tx] ?? {}),
								total: updatedStampCounts[tx].total,
								vouched: updatedStampCounts[tx].vouched,
							};
						}

						dispatch(stampsActions.setStamps(updatedStamps));
					}

					if (arProvider.walletAddress && arProvider.profile) {
						const hasStampedCheck = await stamps.hasStamped(orderbookIds);

						const updatedStampCheck = {};

						for (const tx of Object.keys(updatedStampCounts)) {
							updatedStampCheck[tx] = {
								total: updatedStampCounts[tx].total,
								vouched: updatedStampCounts[tx].vouched,
								hasStamped: hasStampedCheck?.[tx] ?? false,
							};
						}

						dispatch(stampsActions.setStamps(updatedStampCheck));
					}
				} catch (e: any) {
					console.error(e);
				}
			}
		})();
	}, [ucmReducer, arProvider.walletAddress, arProvider.profile]);

	return (
		<>
			<div id={DOM.loader} />
			<div id={DOM.notification} />
			<div id={DOM.overlay} />
			{ucmReducer && !FLAGS.MAINTENANCE ? (
				<Suspense fallback={<Loader />}>
					<S.AppWrapper>
						<Banner />
						<Header />
						<S.View className={'max-view-wrapper'}>
							<Routes />
						</S.View>
						<Footer />
					</S.AppWrapper>
					{showCampaign && (
						<Modal header={null} handleClose={() => setShowCampaign(false)}>
							<S.CampaignWrapper>
								<div className={'content'}>
									<S.CampaignSubheader>
										<p>A tomb opens, and a legend stirs. Do you have what it takes to awaken The Omega One? </p>
									</S.CampaignSubheader>
									<S.PrimaryAssetWrapper>
										<S.PrimaryAssetOverlay>
											<ReactSVG src={ASSETS.question} className={'fade-in'} />
										</S.PrimaryAssetOverlay>
										<img src={getTxEndpoint('Nt58KmL01idgtiDU2BQFWZObEbejnhfFdVyfCEFkEdU')} />
										<S.CampaignAction>
											<Link to={URLS.quest} onClick={() => setShowCampaign(false)}>
												<span>Enter Tomb</span>
											</Link>
										</S.CampaignAction>
									</S.PrimaryAssetWrapper>
								</div>
								<S.MActionWrapper>
									<button onClick={() => setShowCampaign(false)}>Close</button>
								</S.MActionWrapper>
								{getCampaignBackground()}
							</S.CampaignWrapper>
						</Modal>
					)}
				</Suspense>
			) : FLAGS.MAINTENANCE ? (
				<div className={'app-loader'}>
					<ReactSVG src={ASSETS.logo} />
					<div>Bazar is currently offline for maintenance and will return shortly</div>
				</div>
			) : (
				<div className={'app-loader'}>
					<ReactSVG src={ASSETS.logo} />
				</div>
			)}
		</>
	);
}
