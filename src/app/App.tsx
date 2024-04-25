import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { ReactSVG } from 'react-svg';

import { readProcessState } from 'api';

import { ASSETS, DOM, PROCESSES } from 'helpers/config';
import { Footer } from 'navigation/footer';
import { Header } from 'navigation/Header';
import { Routes } from 'routes';
import { RootState } from 'store';
import * as currencyActions from 'store/currencies/actions';
import * as ucmActions from 'store/ucm/actions';

import * as S from './styles';

export default function App() {
	const dispatch = useDispatch();

	const currenciesReducer = useSelector((state: RootState) => state.currenciesReducer);
	const ucmReducer = useSelector((state: RootState) => state.ucmReducer);

	React.useEffect(() => {
		(async function () {
			try {
				const ucmState = await readProcessState(PROCESSES.ucm);
				dispatch(ucmActions.setUCM(ucmState));

				const tokenState = await readProcessState(PROCESSES.token);
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
			{ucmReducer && currenciesReducer ? (
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
