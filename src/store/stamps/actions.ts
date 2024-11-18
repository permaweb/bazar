import { Dispatch } from 'redux';

import { SET_STAMPS } from './constants';

export function setStamps(payload: any) {
	return (dispatch: Dispatch) => {
		dispatch({
			type: SET_STAMPS,
			payload: payload,
		});
	};
}
