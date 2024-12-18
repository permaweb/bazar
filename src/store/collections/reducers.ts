import { ReduxActionType } from 'helpers/types';

import { SET_COLLECTIONS } from './constants';

export const initStateCollections: any = null;

export function collectionsReducer(state: any = initStateCollections, action: ReduxActionType) {
	switch (action.type) {
		case SET_COLLECTIONS:
			return Object.assign({}, state, action.payload);
		default:
			return state;
	}
}
