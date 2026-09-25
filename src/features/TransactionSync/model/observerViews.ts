import type { ArweaveObserverResponseDetail } from 'api/observers';
import type { ObserverView } from 'api/transactions';

import type { ArweaveSyncStep, ArweaveSyncTransaction } from '../types';

import type { TransactionSyncSessionStorage } from './sessionStorage';

const TRANSACTION_SYNC_VIEW_CACHE_VERSION = 1;
const TRANSACTION_SYNC_VIEW_CACHE_PREFIX = 'bazar-transaction-sync-views:v1:';

export type LiveObserverResponseStore = {
	key: string;
	viewsByTransaction: Map<string, Map<string, ObserverView>>;
};

/** Identifies the observed transaction set; a new set starts a new live response store. */
export function liveObserverResponseKey(steps: ArweaveSyncStep[]): string {
	return steps.map((step) => `${step.key}:${step.transaction?.id ?? ''}`).join('|');
}

export function observedTransactionIds(steps: ArweaveSyncStep[]): Set<string> {
	return new Set(steps.flatMap((step) => (step.transaction ? [step.transaction.id] : [])));
}

export function createLiveObserverResponseStore(
	key: string,
	steps: ArweaveSyncStep[],
	storage: TransactionSyncSessionStorage | undefined
): LiveObserverResponseStore {
	const viewsByTransaction = new Map<string, Map<string, ObserverView>>();
	for (const step of steps) {
		if (!step.transaction) continue;
		const views = new Map<string, ObserverView>();
		mergeObserverViewsIntoMap(views, readCachedObserverViews(storage, step.transaction.id));
		mergeObserverViewsIntoMap(views, step.transaction.views);
		viewsByTransaction.set(step.transaction.id, views);
	}
	return { key, viewsByTransaction };
}

export function mergeObserverViewsIntoMap(target: Map<string, ObserverView>, views: ObserverView[]) {
	for (const view of views) {
		const existing = target.get(view.observer.url);
		if (!existing || observerViewTimestamp(view) >= observerViewTimestamp(existing)) {
			target.set(view.observer.url, view);
		}
	}
}

function observerViewTimestamp(view: ObserverView) {
	return Math.max(view.updatedAt, view.lastSeenAt ?? 0);
}

export function readCachedObserverViews(
	storage: TransactionSyncSessionStorage | undefined,
	transactionId: string
): ObserverView[] {
	if (!storage) return [];
	const key = `${TRANSACTION_SYNC_VIEW_CACHE_PREFIX}${transactionId}`;
	try {
		const value = JSON.parse(storage.getItem(key) ?? 'null');
		if (
			!value ||
			value.version !== TRANSACTION_SYNC_VIEW_CACHE_VERSION ||
			value.transactionId !== transactionId ||
			!Array.isArray(value.views) ||
			!value.views.every(isCachedObserverView)
		) {
			if (value !== null) storage.removeItem(key);
			return [];
		}
		return value.views;
	} catch {
		try {
			storage.removeItem(key);
		} catch {
			// A blocked session store should not affect transaction observation.
		}
		return [];
	}
}

export function writeCachedObserverViews(
	storage: TransactionSyncSessionStorage | undefined,
	transactionId: string,
	views: ObserverView[]
) {
	if (!storage || !views.length) return;
	try {
		storage.setItem(
			`${TRANSACTION_SYNC_VIEW_CACHE_PREFIX}${transactionId}`,
			JSON.stringify({ version: TRANSACTION_SYNC_VIEW_CACHE_VERSION, transactionId, views })
		);
	} catch {
		// Visual continuity is best effort; authoritative recovery uses a separate durable record.
	}
}

function isCachedObserverView(value: unknown): value is ObserverView {
	if (!value || typeof value !== 'object') return false;
	const view = value as Partial<ObserverView>;
	return Boolean(
		view.observer &&
			typeof view.observer.url === 'string' &&
			typeof view.observer.label === 'string' &&
			['unknown', 'not-found', 'pending', 'confirmed', 'gone'].includes(view.state ?? '') &&
			Number.isFinite(view.confirmations) &&
			Number.isFinite(view.updatedAt)
	);
}

export function mergeLiveObserverViews(
	transaction: ArweaveSyncTransaction | undefined,
	viewsByTransaction: LiveObserverResponseStore['viewsByTransaction']
): ArweaveSyncTransaction | undefined {
	if (!transaction) return undefined;
	const merged = new Map(transaction.views.map((view) => [view.observer.url, view]));
	for (const view of viewsByTransaction.get(transaction.id)?.values() ?? []) {
		const existing = merged.get(view.observer.url);
		if (!existing || observerViewTimestamp(view) >= observerViewTimestamp(existing)) {
			merged.set(view.observer.url, view);
		}
	}
	return { ...transaction, views: [...merged.values()] };
}

export function observerViewFromResponse(
	detail: ArweaveObserverResponseDetail,
	previous: ObserverView | undefined
): ObserverView | undefined {
	let state: ObserverView['state'];
	let confirmations = 0;
	let blockId: string | undefined;
	let blockHeight: number | undefined;
	if (detail.status === 404) state = 'not-found';
	else if (detail.status === 202) state = 'pending';
	else if (detail.status === 200 && detail.body && typeof detail.body === 'object') {
		const body = detail.body as Record<string, unknown>;
		confirmations = Number(body.number_of_confirmations);
		blockId = typeof body.block_indep_hash === 'string' ? body.block_indep_hash : undefined;
		blockHeight = Number(body.block_height);
		if (!Number.isSafeInteger(confirmations) || confirmations < 1 || !blockId) return undefined;
		if (!Number.isSafeInteger(blockHeight) || blockHeight < 0) blockHeight = undefined;
		state = 'confirmed';
	} else {
		return undefined;
	}

	const changed =
		!previous ||
		previous.state !== state ||
		previous.confirmations !== confirmations ||
		previous.blockId !== blockId ||
		previous.blockHeight !== blockHeight;
	return {
		observer: detail.observer,
		state,
		confirmations,
		...(blockId === undefined ? {} : { blockId }),
		...(blockHeight === undefined ? {} : { blockHeight }),
		...(detail.observer.height === undefined ? {} : { nodeHeight: detail.observer.height }),
		updatedAt: detail.observedAt,
		lastSeenAt: detail.observedAt,
		changedAt: changed ? detail.observedAt : previous.changedAt,
		httpStatus: detail.status,
		latency: detail.latency,
	};
}

export function latestObserverState(views: ObserverView[]): ObserverView['state'] {
	let latest: ObserverView | undefined;
	for (const view of views) {
		if (!latest || view.updatedAt > latest.updatedAt) latest = view;
	}
	return latest?.state ?? 'unknown';
}
