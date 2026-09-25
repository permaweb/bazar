import type { AppError } from './app-error';

// One shape for remote data so loading, background refresh, stale data, and failure cannot contradict each other.
export type AsyncState<T, E = AppError> =
	| { status: 'idle' }
	| { status: 'loading' }
	| { status: 'refreshing'; data: T }
	| { status: 'success'; data: T }
	| { status: 'stale'; data: T; error: E }
	| { status: 'error'; error: E };

export type AsyncStatus = AsyncState<unknown>['status'];

export const IDLE: AsyncState<never, never> = { status: 'idle' };
export const LOADING: AsyncState<never, never> = { status: 'loading' };

export function asyncData<T, E>(state: AsyncState<T, E>): T | undefined {
	return 'data' in state ? state.data : undefined;
}

export function asyncError<T, E>(state: AsyncState<T, E>): E | undefined {
	return 'error' in state ? state.error : undefined;
}

export function isAsyncPending(state: AsyncState<unknown, unknown>): boolean {
	return state.status === 'loading' || state.status === 'refreshing';
}

// Starts a load while keeping any data already on screen visible.
export function beginLoad<T, E>(state: AsyncState<T, E>): AsyncState<T, E> {
	return 'data' in state ? { status: 'refreshing', data: state.data } : LOADING;
}

// Records a failure without discarding known-good data.
export function failLoad<T, E>(state: AsyncState<T, E>, error: E): AsyncState<T, E> {
	return 'data' in state ? { status: 'stale', data: state.data, error } : { status: 'error', error };
}
