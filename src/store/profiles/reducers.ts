import { ReduxActionType } from 'helpers/types';

import { SET_PROFILES } from './constants';

export const initStateProfile: any = {};

export function profilesReducer(state: any = initStateProfile, action: ReduxActionType) {
	switch (action.type) {
		case SET_PROFILES:
			return Object.assign({}, state, action.payload);
		default:
			return state;
	}
}
