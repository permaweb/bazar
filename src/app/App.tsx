import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { ReactSVG } from 'react-svg';

import { readHandler } from 'api';

import { ASSETS, DOM, PROCESSES } from 'helpers/config';
import { Footer } from 'navigation/footer';
import { Header } from 'navigation/Header';
import { Routes } from 'routes';
import { RootState } from 'store';
import * as currencyActions from 'store/currencies/actions';
import * as streakActions from 'store/streaks/actions';
import * as ucmActions from 'store/ucm/actions';

import * as S from './styles';

export default function App() {
	const dispatch = useDispatch();

	const ucmReducer = useSelector((state: RootState) => state.ucmReducer);

	React.useEffect(() => {
		(async function () {
			try {
				const ucmState = await readHandler({
					processId: PROCESSES.ucm,
					action: 'Info',
				});
				dispatch(ucmActions.setUCM(ucmState));

				const streakState = await readHandler({
					processId: PROCESSES.streaks,
					action: 'Info',
				});
				dispatch(streakActions.setStreaks(streakState.Streaks));

				const tokenState = await readHandler({
					processId: PROCESSES.token,
					action: 'Info',
				});
				dispatch(
					currencyActions.setCurrencies({
						[PROCESSES.token]: {
							...tokenState,
						},
					})
				);
			} catch (e: any) {
				console.error(e);
			}
		})();
	}, []);

	return (
		<>
			<div id={DOM.loader} />
			<div id={DOM.notification} />
			<div id={DOM.overlay} />
			{ucmReducer ? (
				<S.AppWrapper>
					<Header />
					<S.View className={'max-view-wrapper'}>
						<Routes />
					</S.View>
					<Footer />
				</S.AppWrapper>
			) : (
				<div className={'app-loader'}>
					<ReactSVG src={ASSETS.logo} />
				</div>
			)}
		</>
	);
}
