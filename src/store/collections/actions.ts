import { Dispatch } from 'redux';

import { SET_COLLECTIONS } from './constants';

export function setCollections(payload: any) {
	return (dispatch: Dispatch) => {
		dispatch({
			type: SET_COLLECTIONS,
			payload: payload,
		});
	};
}
