import { ReduxActionType } from 'helpers/types';

import { SET_STREAKS } from './constants';

export const initStateStreaks: any = null;

export function streaksReducer(state: any = initStateStreaks, action: ReduxActionType) {
	switch (action.type) {
		case SET_STREAKS:
			return Object.assign({}, state, action.payload);
		default:
			return state;
	}
}
