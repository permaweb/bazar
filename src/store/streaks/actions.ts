import { Dispatch } from 'redux';

import { SET_STREAKS } from './constants';

export function setStreaks(payload: any) {
	return (dispatch: Dispatch) => {
		dispatch({
			type: SET_STREAKS,
			payload: payload,
		});
	};
}
