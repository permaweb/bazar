import { ReduxActionType } from 'helpers/types';

import { SET_STAMPS } from './constants';

export const initStateStamps: any = {};

export function stampsReducer(state: any = initStateStamps, action: ReduxActionType) {
	switch (action.type) {
		case SET_STAMPS:
			return Object.assign({}, state, action.payload);
		default:
			return state;
	}
}
