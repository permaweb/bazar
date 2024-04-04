import { AssetStateType, ReduxActionType } from 'helpers/types';

import { SET_CURRENCIES } from './constants';

export const initStateCurrencies: AssetStateType = null;

export function currenciesReducer(state: any = initStateCurrencies, action: ReduxActionType) {
	switch (action.type) {
		case SET_CURRENCIES:
			return Object.assign({}, state, action.payload);
		default:
			return state;
	}
}
