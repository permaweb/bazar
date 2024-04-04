import { Dispatch } from 'redux';

import { SET_CURRENCIES } from './constants';

export function setCurrencies(payload: any) {
	return (dispatch: Dispatch) => {
		dispatch({
			type: SET_CURRENCIES,
			payload: payload,
		});
	};
}
