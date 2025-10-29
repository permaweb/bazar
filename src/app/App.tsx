import React, { lazy, Suspense } from 'react';
import { ReactSVG } from 'react-svg';
import { CurrentZoneVersion } from '@permaweb/libs/browser';

import { Loader } from 'components/atoms/Loader';
import { Banner } from 'components/organisms/Banner';
import { ASSETS, DOM, FLAGS } from 'helpers/config';
import { isVersionGreater } from 'helpers/utils';
import { Footer } from 'navigation/footer';
import { Header } from 'navigation/Header';
import { useArweaveProvider } from 'providers/ArweaveProvider';
import { usePermawebProvider } from 'providers/PermawebProvider';

import * as S from './styles';

const Routes = lazy(() =>
	import(`../routes/Routes.tsx` as any).then((module) => ({
		default: module.default,
	}))
);

export default function App() {
	const permawebProvider = usePermawebProvider();
	const hasCheckedProfileRef = React.useRef(false);

	React.useEffect(() => {
		(async function () {
			if (hasCheckedProfileRef.current) return;
			if (
				permawebProvider.profile &&
				typeof permawebProvider.profile.id === 'string' &&
				permawebProvider.profile.id.length === 43
			) {
				const userVersion = permawebProvider.profile.version;
				if (!userVersion || isVersionGreater(CurrentZoneVersion, userVersion)) {
					await permawebProvider.libs.updateProfileVersion({
						profileId: permawebProvider.profile.id,
					});
					hasCheckedProfileRef.current = true;
				}
			}
		})();
	}, [permawebProvider.profile]);

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
