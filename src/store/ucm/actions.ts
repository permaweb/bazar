import { Dispatch } from 'redux';

import { SET_UCM } from './constants';

export function setUCM(payload: any) {
	return (dispatch: Dispatch) => {
		dispatch({
			type: SET_UCM,
			payload: payload,
		});
	};
}
