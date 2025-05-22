import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { isEqual } from 'lodash';

import { readHandler, stamps } from 'api';

import { AO } from 'helpers/config';
import { RootState } from 'store';
import * as currencyActions from 'store/currencies/actions';
import * as stampsActions from 'store/stamps/actions';
import * as streakActions from 'store/streaks/actions';
import * as ucmActions from 'store/ucm/actions';

import { useArweaveProvider } from './ArweaveProvider';
import { usePermawebProvider } from './PermawebProvider';

export interface AppContextState {
	ucm: { updating: boolean; completed: boolean; lastUpdate?: number };
	streaks: { updating: boolean; completed: boolean; lastUpdate?: number };
	stamps: { updating: boolean; completed: boolean; lastUpdate?: number };
	refreshUcm: () => void;
}

export interface AppProviderProps {
	children: React.ReactNode;
}

export const AppContext = React.createContext<AppContextState>({
	ucm: { updating: false, completed: false },
	streaks: { updating: false, completed: false },
	stamps: { updating: false, completed: false },
	refreshUcm: () => {},
});

export function useAppProvider(): AppContextState {
	return React.useContext(AppContext);
}

// TODO
export function AppProvider(props: AppProviderProps) {
	const dispatch = useDispatch();

	const currenciesReducer = useSelector((state: RootState) => state.currenciesReducer);
	const stampsReducer = useSelector((state: RootState) => state.stampsReducer);
	const ucmReducer = useSelector((state: RootState) => state.ucmReducer);

	const permawebProvider = usePermawebProvider();
	const arProvider = useArweaveProvider();

	const [ucmState, setUCMState] = React.useState<AppContextState['ucm']>({
		updating: false,
		completed: false,
		lastUpdate: ucmReducer?.lastUpdate,
	});

	const [ucmRefreshTrigger, setUcmRefreshTrigger] = React.useState<boolean | null>(null);

	const [streaksState, setStreaksState] = React.useState<AppContextState['streaks']>({
		updating: false,
		completed: false,
		lastUpdate: undefined,
	});

	const [stampsState, setStampsState] = React.useState<AppContextState['stamps']>({
		updating: false,
		completed: true, // TODO: Init false
		lastUpdate: undefined,
	});

	// React.useEffect(() => {
	// 	if (stampsReducer) setStampsState((prevState) => ({ ...prevState, completed: true }));
	// }, [stampsReducer]);

	React.useEffect(() => {
		(async function () {
			setUCMState((prevState) => ({ ...prevState, updating: true }));

			try {
				const ucmState = await readHandler({
					processId: AO.ucm,
					action: 'Info',
				});

				dispatch(
					ucmActions.setUCM({
						...ucmState,
						lastUpdate: Date.now(),
					})
				);

				setUCMState({
					updating: false,
					completed: true,
					lastUpdate: Date.now(),
				});
			} catch (e: any) {
				console.error(e);
				setUCMState((prevState) => ({ ...prevState, updating: false }));
			}
		})();
	}, []);

	React.useEffect(() => {
		(async function () {
			setUCMState((prevState) => ({ ...prevState, updating: true }));

			try {
				// const ucmState = await readHandler({
				// 	processId: AO.ucm,
				// 	action: 'Info',
				// });

				dispatch(
					ucmActions.setUCM({
						Orderbook: [],
						lastUpdate: Date.now(),
					})
				);

				setUCMState({
					updating: false,
					completed: true,
					lastUpdate: Date.now(),
				});
			} catch (e: any) {
				console.error(e);
				setUCMState((prevState) => ({ ...prevState, updating: false }));
			}
		})();
	}, []);

	// React.useEffect(() => {
	// 	const fetchAndCompareUCM = async () => {
	// 		setUCMState((prevState) => ({ ...prevState, updating: true }));

	// 		try {
	// 			const newUCMState = await readHandler({
	// 				processId: AO.ucm,
	// 				action: 'Info',
	// 			});

	// 			const normalizedOrders = (ucm) =>
	// 				ucm?.Orderbook?.map((entry) => ({
	// 					Pair: entry.Pair?.sort() || [],
	// 					PriceData: entry.PriceData
	// 						? {
	// 								...entry.PriceData,
	// 								MatchLogs: entry.PriceData.MatchLogs
	// 									? entry.PriceData.MatchLogs.map((log) => ({
	// 											...log,
	// 									  })).sort((a, b) => a.Id.localeCompare(b.Id))
	// 									: [],
	// 						  }
	// 						: null,
	// 					Orders: entry.Orders
	// 						? entry.Orders.map((order) => ({
	// 								...order,
	// 						  })).sort((a, b) => a.Id.localeCompare(b.Id))
	// 						: [],
	// 				})).sort((a, b) => JSON.stringify(a.Pair).localeCompare(JSON.stringify(b.Pair))) || [];

	// 			const currentOrders = normalizedOrders(ucmReducer);
	// 			const newOrders = normalizedOrders(newUCMState);

	// 			const hasDifferences = !isEqual(currentOrders, newOrders);

	// 			if (hasDifferences) {
	// 				dispatch(
	// 					ucmActions.setUCM({
	// 						...newUCMState,
	// 						lastUpdate: Date.now(),
	// 					})
	// 				);

	// 				setUCMState({
	// 					updating: false,
	// 					completed: true,
	// 					lastUpdate: Date.now(),
	// 				});

	// 				setUcmRefreshTrigger(null);

	// 				return true;
	// 			} else {
	// 				setUCMState((prevState) => ({
	// 					...prevState,
	// 					updating: false,
	// 				}));
	// 				return false;
	// 			}
	// 		} catch (e) {
	// 			console.error(e);
	// 			setUCMState((prevState) => ({ ...prevState, updating: false }));
	// 			return true;
	// 		}
	// 	};

	// 	let isPolling = false;

	// 	const pollUntilDifference = async () => {
	// 		if (isPolling) return;
	// 		isPolling = true;

	// 		let differencesDetected = false;
	// 		do {
	// 			differencesDetected = await fetchAndCompareUCM();
	// 			if (!differencesDetected) {
	// 				await new Promise((resolve) => setTimeout(resolve, 2000));
	// 			}
	// 		} while (!differencesDetected);

	// 		isPolling = false;
	// 	};

	// 	if (ucmRefreshTrigger !== null) {
	// 		pollUntilDifference();
	// 	}
	// }, [ucmRefreshTrigger, ucmReducer]);

	React.useEffect(() => {
		(async function () {
			setStreaksState((prevState) => ({ ...prevState, updating: true }));

			try {
				const streaks = await readHandler({
					processId: AO.pixl,
					action: 'Get-Streaks',
				});

				if (streaks.Streaks) {
					for (let key in streaks.Streaks) {
						if (streaks.Streaks[key].days === 0) {
							delete streaks.Streaks[key];
						}
					}
					dispatch(streakActions.setStreaks(streaks.Streaks));

					setStreaksState({
						updating: false,
						completed: true,
						lastUpdate: Date.now(),
					});
				}
			} catch (e: any) {
				console.error(e);
				setStreaksState((prevState) => ({ ...prevState, updating: false }));
			}
		})();
	}, []);

	// React.useEffect(() => {
	// 	(async function () {
	// 		if (ucmReducer) {
	// 			setStampsState((prevState) => ({ ...prevState, updating: true }));

	// 			try {
	// 				const orderbookIds =
	// 					ucmReducer && ucmReducer.Orderbook && ucmReducer.Orderbook.length > 0
	// 						? ucmReducer.Orderbook.map((p: any) => (p.Pair.length > 0 ? p.Pair[0] : null)).filter(
	// 								(p: any) => p !== null
	// 						  )
	// 						: [];

	// 				const updatedStampCounts = await stamps.getStamps({ ids: orderbookIds });

	// 				const updatedStamps = {};
	// 				if (updatedStampCounts) {
	// 					for (const tx of Object.keys(updatedStampCounts)) {
	// 						updatedStamps[tx] = {
	// 							...(stampsReducer?.[tx] ?? {}),
	// 							total: updatedStampCounts[tx].total,
	// 							vouched: updatedStampCounts[tx].vouched,
	// 						};
	// 					}

	// 					dispatch(stampsActions.setStamps(updatedStamps));
	// 					setStampsState({
	// 						updating: false,
	// 						completed: true,
	// 						lastUpdate: Date.now(),
	// 					});
	// 				}
	// 				setStampsState((prevState) => ({ ...prevState, updating: false }));

	// 				if (arProvider.walletAddress && arProvider.profile) {
	// 					const hasStampedCheck = await stamps.hasStamped(orderbookIds);

	// 					const updatedStampCheck = {};

	// 					for (const tx of Object.keys(updatedStampCounts)) {
	// 						updatedStampCheck[tx] = {
	// 							total: updatedStampCounts[tx].total,
	// 							vouched: updatedStampCounts[tx].vouched,
	// 							hasStamped: hasStampedCheck?.[tx] ?? false,
	// 						};
	// 					}

	// 					dispatch(stampsActions.setStamps(updatedStampCheck));
	// 				}
	// 			} catch (e: any) {
	// 				console.error(e);
	// 				setStampsState((prevState) => ({ ...prevState, updating: false }));
	// 			}
	// 		}
	// 	})();
	// }, [ucmReducer, arProvider.walletAddress, arProvider.profile]);

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

	return (
		<AppContext.Provider
			value={{
				ucm: ucmState,
				streaks: streaksState,
				stamps: stampsState,
				refreshUcm: () => {
					setUcmRefreshTrigger((prev) => (prev === null ? true : !prev));
				},
			}}
		>
			{props.children}
		</AppContext.Provider>
	);
}
