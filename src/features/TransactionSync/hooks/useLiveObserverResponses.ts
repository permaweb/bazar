import React from 'react';

import { ARWEAVE_OBSERVER_RESPONSE_EVENT, type ArweaveObserverResponseDetail } from 'api/observers';
import type { ObserverView } from 'api/transactions';

import {
	createLiveObserverResponseStore,
	liveObserverResponseKey,
	type LiveObserverResponseStore,
	mergeLiveObserverViews,
	mergeObserverViewsIntoMap,
	observedTransactionIds,
	observerViewFromResponse,
	writeCachedObserverViews,
} from '../model/observerViews';
import { browserSessionStorage } from '../model/sessionStorage';
import type { ArweaveSyncStep } from '../types';

const LIVE_RESPONSE_BATCH_MS = 50;

/**
 * Merges live observer responses broadcast by the observer network into the given steps, restoring and persisting
 * each transaction's latest views in session storage. Responses are batched into one render per 50 ms.
 */
export function useLiveObserverResponses(steps: ArweaveSyncStep[]): ArweaveSyncStep[] {
	const key = liveObserverResponseKey(steps);
	const storeRef = React.useRef<LiveObserverResponseStore>();
	if (!storeRef.current) storeRef.current = createLiveObserverResponseStore(key, steps, browserSessionStorage());
	const [version, setVersion] = React.useState(0);
	if (storeRef.current.key !== key) {
		storeRef.current = createLiveObserverResponseStore(key, steps, browserSessionStorage());
	}
	const store = storeRef.current;

	// The subscription is keyed by the observed transaction set: `store` and `steps` change with `key`, and newer
	// views for the same transactions arrive through the event stream rather than by resubscribing.
	React.useEffect(() => {
		const transactionIds = observedTransactionIds(steps);
		for (const step of steps) {
			if (!step.transaction) continue;
			const transactionViews =
				store.viewsByTransaction.get(step.transaction.id) ?? new Map<string, ObserverView>();
			mergeObserverViewsIntoMap(transactionViews, step.transaction.views);
			store.viewsByTransaction.set(step.transaction.id, transactionViews);
			writeCachedObserverViews(browserSessionStorage(), step.transaction.id, [...transactionViews.values()]);
		}
		let flushTimer: number | undefined;
		const scheduleRender = () => {
			if (flushTimer !== undefined) return;
			flushTimer = window.setTimeout(() => {
				flushTimer = undefined;
				setVersion((current) => current + 1);
			}, LIVE_RESPONSE_BATCH_MS);
		};
		const handleResponse = (event: Event) => {
			const detail = (event as CustomEvent<ArweaveObserverResponseDetail>).detail;
			if (!detail || !transactionIds.has(detail.transactionId)) return;
			const transactionViews =
				store.viewsByTransaction.get(detail.transactionId) ?? new Map<string, ObserverView>();
			const previous = transactionViews.get(detail.observer.url);
			const view = observerViewFromResponse(detail, previous);
			if (!view) return;
			transactionViews.set(detail.observer.url, view);
			store.viewsByTransaction.set(detail.transactionId, transactionViews);
			writeCachedObserverViews(browserSessionStorage(), detail.transactionId, [...transactionViews.values()]);
			scheduleRender();
		};

		window.addEventListener(ARWEAVE_OBSERVER_RESPONSE_EVENT, handleResponse);
		return () => {
			window.removeEventListener(ARWEAVE_OBSERVER_RESPONSE_EVENT, handleResponse);
			if (flushTimer !== undefined) window.clearTimeout(flushTimer);
		};
	}, [key]);

	return React.useMemo(
		() =>
			steps.map((step) => ({
				...step,
				transaction: mergeLiveObserverViews(step.transaction, store.viewsByTransaction),
			})),
		[steps, version]
	);
}
