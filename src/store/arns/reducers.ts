import { AnyAction } from 'redux';

export interface ARNSState {
	arnsById: Record<string, any>;
	lastFetched: number | null;
	loading: boolean;
	error: string | null;
}

const initialState: ARNSState = {
	arnsById: {},
	lastFetched: null,
	loading: false,
	error: null,
};

export const arnsReducer = (state = initialState, action: AnyAction): ARNSState => {
	switch (action.type) {
		case 'ARNS/HYDRATE':
			console.log('[ARNS CACHE] Hydrating from localStorage:', action.payload);
			return {
				...state,
				arnsById: action.payload.arnsById,
				lastFetched: action.payload.lastFetched,
				loading: false,
				error: null,
			};
		case 'ARNS/FETCH_START':
			return { ...state, loading: true, error: null };
		case 'ARNS/FETCH_SUCCESS':
			console.log('[ARNS CACHE] Fetched and updated cache:', action.payload);
			return {
				...state,
				arnsById: action.payload.arnsById,
				lastFetched: action.payload.lastFetched,
				loading: false,
				error: null,
			};
		case 'ARNS/FETCH_FAILURE':
			console.warn('[ARNS CACHE] Fetch failed:', action.payload);
			return { ...state, loading: false, error: action.payload };
		default:
			return state;
	}
};
