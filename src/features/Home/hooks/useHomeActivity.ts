import React from 'react';

import type { Collection } from 'api/collections';
import {
	type CollectionActivityEvent,
	confirmPurchaseActivity,
	discoverAllCollectionActivityBatched,
	loadMarketActivity,
	saveMarketActivity,
} from 'api/discovery';
import { readAssetStateCached } from 'api/marketplace';
import { operationWithDeadline } from 'api/network';

import { globalActivityCollection, globalActivityRecipientIds, newestCollectionActivity } from 'features/Activity';
import type { AppError } from 'helpers/app-error';

import {
	homeActivityHistoryError,
	homeActivityReducer,
	homeActivityScope,
	homeActivityView,
	INITIAL_HOME_ACTIVITY,
	mergeHomeActivityEvents,
} from '../model/home-activity';

export type HomeActivityFeed = {
	scope: string;
	events: CollectionActivityEvent[];
	recipientCount: number;
	hasMoreAssets: boolean;
	loading: boolean;
	error: AppError | undefined;
	verifyingPurchases: boolean;
	purchaseVerificationFailures: number;
	purchaseVerificationIncomplete: boolean;
	retry(): void;
};

// Browser storage is optional: an unreadable cache simply means the live scan starts from nothing.
function restoreActivity(scope: string, collections: Collection[]): CollectionActivityEvent[] {
	try {
		return loadMarketActivity(window.localStorage, scope).filter((event) =>
			Boolean(globalActivityCollection(collections, event.processId))
		);
	} catch {
		return [];
	}
}

// The live result stays on screen when storage is unavailable; the return value records whether it was cached.
function persistActivity(scope: string, events: CollectionActivityEvent[]): boolean {
	try {
		saveMarketActivity(window.localStorage, scope, events);
		return true;
	} catch {
		return false;
	}
}

/**
 * Complete indexed market history for every loaded collection, rendered cache-first and then verified for purchase
 * proofs. Cached events show immediately; the index scan publishes pages once per animation frame; proof verification
 * runs within a 45-second budget after (and, for cached events, alongside) the scan.
 */
export function useHomeActivity(collections: Collection[], marketLoading: boolean): HomeActivityFeed {
	const [state, dispatch] = React.useReducer(homeActivityReducer, INITIAL_HOME_ACTIVITY);
	const [retryAttempt, setRetryAttempt] = React.useState(0);
	const view = homeActivityView(state);
	const eventsRef = React.useRef(view.events);
	const scopeRef = React.useRef('');
	eventsRef.current = view.events;
	const scope = homeActivityScope(collections);
	const recipients = React.useMemo(() => globalActivityRecipientIds(collections), [collections]);
	const retry = React.useCallback(() => setRetryAttempt((attempt) => attempt + 1), []);

	React.useEffect(() => {
		if (!scope || scopeRef.current === scope) return;
		const cachedEvents = restoreActivity(scope, collections);
		if (!cachedEvents.length) return;
		scopeRef.current = scope;
		eventsRef.current = cachedEvents;
		dispatch({ type: 'restored', events: cachedEvents });
	}, [collections, scope]);

	React.useEffect(() => {
		if (marketLoading) return;
		if (!collections.length) {
			dispatch({ type: 'cleared' });
			return;
		}
		const controller = new AbortController();
		const sameScope = scopeRef.current === scope;
		const cachedEvents = sameScope ? [] : restoreActivity(scope, collections);
		const initialEvents = sameScope && eventsRef.current.length ? eventsRef.current : cachedEvents;
		const preserveEvents = initialEvents.length > 0;
		const found = new Map(initialEvents.map((event) => [event.id, event]));
		scopeRef.current = scope;
		if (!preserveEvents) {
			eventsRef.current = [];
			dispatch({ type: 'started', events: [] });
		} else if (!sameScope) {
			eventsRef.current = initialEvents;
			dispatch({ type: 'started', events: initialEvents });
		} else {
			dispatch({ type: 'started' });
		}
		let publishFrame: number | undefined;
		const commitFound = () => {
			publishFrame = undefined;
			if (controller.signal.aborted) return;
			eventsRef.current = newestCollectionActivity([...found.values()], Number.MAX_SAFE_INTEGER);
			dispatch({ type: 'published', events: eventsRef.current });
		};
		const publish = (nextEvents: CollectionActivityEvent[], immediately = false) => {
			if (controller.signal.aborted) return;
			mergeHomeActivityEvents(found, nextEvents);
			if (immediately) {
				if (publishFrame !== undefined) window.cancelAnimationFrame(publishFrame);
				commitFound();
			} else {
				publishFrame ??= window.requestAnimationFrame(commitFound);
			}
		};
		const proofFailureProcesses = new Set<string>();
		const publishedProofPayments = new Set(
			initialEvents.flatMap((event) =>
				event.purchaseProof?.transactionId ? [event.purchaseProof.transactionId] : []
			)
		);
		let proofVerificationIncomplete = false;
		const verifyPurchases = async (candidates: CollectionActivityEvent[]) => {
			if (!candidates.some((event) => event.action === 'register-interest' && !event.purchaseProof)) return;
			dispatch({ type: 'verification-started' });
			try {
				await operationWithDeadline(
					(signal) =>
						confirmPurchaseActivity(candidates, {
							signal,
							verificationTimeoutMs: 15_000,
							onFailure: (processId) => {
								proofFailureProcesses.add(processId);
							},
							onProof: (event) => {
								const paymentId = event.purchaseProof?.transactionId;
								if (!paymentId || publishedProofPayments.has(paymentId)) return;
								publishedProofPayments.add(paymentId);
								publish([event]);
							},
							readCurrent: (processId, readSignal) =>
								readAssetStateCached(processId, { signal: readSignal, maxAttempts: 1 }),
						}),
					controller.signal,
					{
						timeoutMs: 45_000,
						timeoutError: 'purchase-proof-verification-budget-exhausted',
					}
				);
			} catch {
				if (controller.signal.aborted) return;
				proofVerificationIncomplete = true;
			}
		};
		const initialEventIds = new Set(initialEvents.map((event) => event.id));
		// Cached activity can be verified immediately while the index refresh runs.
		// This prevents a complete recipient scan from delaying recent purchase proofs.
		const initialVerification = verifyPurchases(initialEvents);
		void (async () => {
			const historyFailures: unknown[] = [];
			try {
				const completeEvents = await discoverAllCollectionActivityBatched({
					recipients,
					concurrency: 2,
					signal: controller.signal,
					onPage: (page) => publish(page),
				});
				publish(completeEvents, true);
			} catch (cause) {
				if (controller.signal.aborted) return;
				historyFailures.push(cause);
			}
			if (controller.signal.aborted) return;
			if (publishFrame !== undefined) window.cancelAnimationFrame(publishFrame);
			commitFound();
			// The complete indexed-history scan ends here. Purchase-proof verification is
			// slower optional enrichment and must not keep the history loader running.
			dispatch({ type: 'history-finished' });
			try {
				await initialVerification;
				await verifyPurchases(
					initialEvents.length
						? eventsRef.current.filter((event) => !initialEventIds.has(event.id))
						: eventsRef.current
				);
			} catch {
				if (controller.signal.aborted) return;
				proofVerificationIncomplete = true;
			}
			if (controller.signal.aborted) return;
			if (publishFrame !== undefined) window.cancelAnimationFrame(publishFrame);
			publishFrame = undefined;
			commitFound();
			persistActivity(scope, eventsRef.current);
			dispatch({
				type: 'settled',
				failures: proofFailureProcesses.size,
				incomplete: proofVerificationIncomplete,
				error: homeActivityHistoryError(historyFailures),
			});
		})();
		return () => {
			controller.abort();
			if (publishFrame !== undefined) window.cancelAnimationFrame(publishFrame);
		};
	}, [collections, marketLoading, recipients, retryAttempt, scope]);

	return {
		scope,
		events: view.events,
		recipientCount: recipients.length,
		hasMoreAssets: collections.some((collection) => collection.hasMore),
		loading: view.loading,
		error: view.error,
		verifyingPurchases: view.verifyingPurchases,
		purchaseVerificationFailures: view.purchaseVerificationFailures,
		purchaseVerificationIncomplete: view.purchaseVerificationIncomplete,
		retry,
	};
}
