import type { AsyncState } from 'helpers/async-state';

/**
 * Replace the data an async state shows while keeping whether a load is still pending and any failure it reports.
 * Progressive loads publish partial data this way: a first load that receives data becomes `refreshing`.
 */
export function replaceAsyncData<T, E>(state: AsyncState<T, E>, data: T): AsyncState<T, E> {
	switch (state.status) {
		case 'idle':
		case 'success':
			return { status: 'success', data };
		case 'loading':
		case 'refreshing':
			return { status: 'refreshing', data };
		case 'stale':
		case 'error':
			return { status: 'stale', data, error: state.error };
	}
}

/** Finish a pending load that did not fail. A load that never received data settles on `empty`. */
export function settleAsyncData<T, E>(state: AsyncState<T, E>, empty: T): AsyncState<T, E> {
	if (state.status === 'refreshing') return { status: 'success', data: state.data };
	if (state.status === 'loading') return { status: 'success', data: empty };
	return state;
}
