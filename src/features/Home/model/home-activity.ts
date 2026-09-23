import { type Collection, collectionAsset } from 'api/collections';
import type { CollectionActivityEvent } from 'api/discovery';

import { collectionActivityVersion, globalActivityCollection } from 'features/Activity';
import { type AppError, appError, requestFailureKind } from 'helpers/app-error';
import { type AsyncState, failLoad } from 'helpers/async-state';

export type HomeActivityVerification =
	| { status: 'idle' }
	| { status: 'verifying' }
	| { status: 'settled'; failures: number; incomplete: boolean };

/**
 * The global activity feed: the complete indexed history scan, then optional purchase-proof verification.
 *
 * `history` keeps loaded events visible through refreshes and failures. Verification runs after (or alongside) the
 * history scan and never holds the history loader open.
 */
export type HomeActivityState = {
	history: AsyncState<CollectionActivityEvent[]>;
	verification: HomeActivityVerification;
};

export type HomeActivityEvent =
	// Cached events for a new scope replace the visible events without changing the scan's progress.
	| { type: 'restored'; events: CollectionActivityEvent[] }
	// No collections are loaded, so there is nothing to scan. An earlier failure stays visible.
	| { type: 'cleared' }
	// A scan starts. `events` replaces the visible events; omit it to keep them.
	| { type: 'started'; events?: CollectionActivityEvent[] }
	| { type: 'published'; events: CollectionActivityEvent[] }
	| { type: 'history-finished' }
	| { type: 'verification-started' }
	| { type: 'settled'; failures: number; incomplete: boolean; error?: AppError };

const NO_EVENTS: CollectionActivityEvent[] = [];

export const INITIAL_HOME_ACTIVITY: HomeActivityState = {
	history: { status: 'loading' },
	verification: { status: 'idle' },
};

export function homeActivityReducer(state: HomeActivityState, event: HomeActivityEvent): HomeActivityState {
	switch (event.type) {
		case 'restored':
		case 'published':
			return { ...state, history: replaceHistoryEvents(state.history, event.events) };
		case 'cleared':
			return {
				history:
					'error' in state.history
						? { status: 'error', error: state.history.error }
						: { status: 'success', data: [] },
				verification: { status: 'idle' },
			};
		case 'started': {
			const events = event.events ?? homeActivityEvents(state);
			return {
				history: events.length ? { status: 'refreshing', data: events } : { status: 'loading' },
				verification: { status: 'idle' },
			};
		}
		case 'history-finished':
			if (state.history.status === 'loading') return { ...state, history: { status: 'success', data: [] } };
			if (state.history.status === 'refreshing') {
				return { ...state, history: { status: 'success', data: state.history.data } };
			}
			return state;
		case 'verification-started':
			return state.verification.status === 'verifying'
				? state
				: { ...state, verification: { status: 'verifying' } };
		case 'settled':
			return {
				history: event.error ? failLoad(state.history, event.error) : state.history,
				verification: { status: 'settled', failures: event.failures, incomplete: event.incomplete },
			};
	}
}

// Replaces the loaded events while keeping the history's progress and any failure.
function replaceHistoryEvents(
	history: AsyncState<CollectionActivityEvent[]>,
	events: CollectionActivityEvent[]
): AsyncState<CollectionActivityEvent[]> {
	switch (history.status) {
		case 'idle':
		case 'success':
			return { status: 'success', data: events };
		case 'loading':
		case 'refreshing':
			return { status: 'refreshing', data: events };
		case 'stale':
		case 'error':
			return { status: 'stale', data: events, error: history.error };
	}
}

export function homeActivityEvents(state: HomeActivityState): CollectionActivityEvent[] {
	return 'data' in state.history ? state.history.data : NO_EVENTS;
}

export function homeActivityView(state: HomeActivityState) {
	return {
		events: homeActivityEvents(state),
		loading: state.history.status === 'loading' || state.history.status === 'refreshing',
		error: 'error' in state.history ? state.history.error : undefined,
		verifyingPurchases: state.verification.status === 'verifying',
		purchaseVerificationFailures: state.verification.status === 'settled' ? state.verification.failures : 0,
		purchaseVerificationIncomplete: state.verification.status === 'settled' ? state.verification.incomplete : false,
	};
}

// Identifies the collections and asset windows whose history is cached and scanned together.
export function homeActivityScope(collections: Collection[]) {
	return collections
		.map((collection) => `${collection.id}:${collectionActivityVersion(collection)}`)
		.sort()
		.join('|');
}

// The loaded asset an activity event refers to, when its collection is part of the market.
export function homeActivityAsset(collections: Collection[], event: CollectionActivityEvent) {
	const collection = globalActivityCollection(collections, event.processId);
	return collection ? collectionAsset(collection, event.processId) : undefined;
}

// Adds newly found events, keeping a purchase proof already attached to an event the index returns again.
export function mergeHomeActivityEvents(
	found: Map<string, CollectionActivityEvent>,
	events: CollectionActivityEvent[]
) {
	for (const event of events) {
		const previous = found.get(event.id);
		found.set(
			event.id,
			previous?.purchaseProof && !event.purchaseProof
				? { ...event, purchaseProof: previous.purchaseProof }
				: event
		);
	}
}

// The index failure the feed reports once the history scan has stopped short: rate limiting wins over other outages.
export function homeActivityHistoryError(failures: unknown[]): AppError | undefined {
	if (!failures.length) return undefined;
	return failures.some((cause) => requestFailureKind(cause) === 'rate-limited')
		? appError('index-rate-limited')
		: appError('index-unavailable');
}
