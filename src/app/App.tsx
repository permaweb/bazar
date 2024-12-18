import React, { lazy, Suspense } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { ReactSVG } from 'react-svg';

import { Loader } from 'components/atoms/Loader';
import { Modal } from 'components/molecules/Modal';
import { Banner } from 'components/organisms/Banner';
import { ASSETS, DOM, FLAGS, URLS } from 'helpers/config';
import { getTxEndpoint } from 'helpers/endpoints';
import { Footer } from 'navigation/footer';
import { Header } from 'navigation/Header';
import { useLocationProvider } from 'providers/LocationProvider';
import { RootState } from 'store';
import { getCampaignBackground } from 'views/Campaign';

import * as S from './styles';

const Routes = lazy(() =>
	import(`../routes/Routes.tsx` as any).then((module) => ({
		default: module.default,
	}))
);

export default function App() {
	const ucmReducer = useSelector((state: RootState) => state.ucmReducer);

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
