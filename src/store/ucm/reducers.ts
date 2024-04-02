import { ReduxActionType } from 'helpers/types';

import { SET_UCM } from './constants';

export const initStateUCM: any = null;

export function ucmReducer(state: any = initStateUCM, action: ReduxActionType) {
	switch (action.type) {
		case SET_UCM:
			return Object.assign({}, state, action.payload);
		default:
			return state;
	}
}
