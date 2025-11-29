import React, { lazy, Suspense } from 'react';
import { ReactSVG } from 'react-svg';

import { Loader } from 'components/atoms/Loader';
import { Banner } from 'components/organisms/Banner';
import { ASSETS, DOM, FLAGS } from 'helpers/config';
import { Footer } from 'navigation/footer';
import { Header } from 'navigation/Header';

import * as S from './styles';

const Routes = lazy(() =>
	import(`../routes/Routes.tsx` as any).then((module) => ({
		default: module.default,
	}))
);

export default function App() {
	React.useEffect(() => {
		document.body.style = '';
		const loader = document.getElementById('page-loader');
		if (loader) {
			loader.style.display = 'none';
		}
	}, []);

	return (
		<>
			<div id={DOM.loader} />
			<div id={DOM.notification} />
			<div id={DOM.overlay} />
			{!FLAGS.MAINTENANCE ? (
				<Suspense fallback={<Loader />}>
					<S.AppWrapper>
						<Banner />
						<Header />
						<S.View className={'max-view-wrapper'}>
							<Routes />
						</S.View>
						<Footer />
					</S.AppWrapper>
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
