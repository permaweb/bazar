import { Dispatch } from 'redux';

import { SET_PROFILES } from './constants';

export function setProfiles(payload: any) {
	return (dispatch: Dispatch) => {
		dispatch({
			type: SET_PROFILES,
			payload: payload,
		});
	};
}
