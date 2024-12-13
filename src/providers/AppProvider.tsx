import React from 'react';
import { useDispatch } from 'react-redux';

import { readHandler } from 'api';

import { AO } from 'helpers/config';
import * as streakActions from 'store/streaks/actions';
import * as ucmActions from 'store/ucm/actions';

export interface AppContextState {
	ucm: { updating: boolean };
	streaks: { updating: boolean };
}

export interface AppProviderProps {
	children: React.ReactNode;
}

export const AppContext = React.createContext<AppContextState>({
	ucm: { updating: false },
	streaks: { updating: false },
});

export function useAppProvider(): AppContextState {
	return React.useContext(AppContext);
}

export function AppProvider(props: AppProviderProps) {
	const dispatch = useDispatch();

	const [ucmUpdating, setUCMUpdating] = React.useState<boolean>(false);
	const [streaksUpdating, setStreaksUpdating] = React.useState<boolean>(false);

	React.useEffect(() => {
		(async function () {
			setUCMUpdating(true);
			try {
				const ucmState = await readHandler({
					processId: AO.ucm,
					action: 'Info',
				});

				dispatch(ucmActions.setUCM(ucmState));
			} catch (e: any) {
				console.error(e);
			} finally {
				setUCMUpdating(false);
			}
		})();
	}, []);

	React.useEffect(() => {
		(async function () {
			setStreaksUpdating(true);
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
				}
			} catch (e: any) {
				console.error(e);
			} finally {
				setStreaksUpdating(false);
			}
		})();
	}, []);

	return (
		<AppContext.Provider
			value={{
				ucm: { updating: ucmUpdating },
				streaks: { updating: streaksUpdating },
			}}
		>
			{props.children}
		</AppContext.Provider>
	);
}
