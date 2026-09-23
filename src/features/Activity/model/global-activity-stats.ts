import {
	type CollectionActivityEvent,
	type CollectionActivityPageOptions,
	discoverCollectionActivityPage,
} from 'api/discovery';

import { appError } from 'helpers/app-error';
import { isArweaveId } from 'helpers/arweave-id';
import { GLOBAL_ACTIVITY_STATS_STORAGE_KEY } from 'helpers/browser-storage';

import { type GlobalActivityChartStats, globalActivityChartStats } from './activity-chart';
import { mergeIndexedActivityEvent } from './global-activity';

export const GLOBAL_ACTIVITY_STATS_MAX_AGE = 5 * 60_000;
type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;
export type GlobalActivityStatsSnapshot = { scope: string; savedAt: number; stats: GlobalActivityChartStats };

/** Independent history reader with a small worker pool and resumable failed pages. */
export function createGlobalActivityStatsScan(
	recipients: string[],
	options: Pick<CollectionActivityPageOptions, 'fetch' | 'graphql' | 'requestTimeoutMs'> = {}
) {
	const ids = [...new Set(recipients.filter((id) => isArweaveId(id)))].sort();
	const batches = Array.from({ length: Math.ceil(ids.length / 100) }, (_, index) => ({
		recipients: ids.slice(index * 100, (index + 1) * 100),
		cursor: null as string | null,
		visited: new Set<string>(),
		complete: false,
	}));
	const events = new Map<string, CollectionActivityEvent>();
	return {
		reset() {
			events.clear();
			for (const batch of batches) {
				batch.cursor = null;
				batch.visited.clear();
				batch.complete = false;
			}
		},
		async run(signal: AbortSignal, beforePage: () => Promise<void> = async () => {}) {
			const pending = batches.filter((batch) => !batch.complete);
			let nextBatch = 0;
			let failed = false;
			let failure: unknown;
			await Promise.all(
				Array.from({ length: Math.min(4, pending.length) }, async () => {
					try {
						while (!failed) {
							const batch = pending[nextBatch++];
							if (!batch) return;
							while (!batch.complete && !failed) {
								signal.throwIfAborted();
								await beforePage();
								signal.throwIfAborted();
								if (failed) return;
								if (batch.visited.size >= 1_000)
									throw appError('invalid-response', {
										message: 'collection-activity-pagination-limit',
									});
								const page = await discoverCollectionActivityPage({
									...options,
									recipients: batch.recipients,
									cursor: batch.cursor,
									pageSize: 100,
									includeCount: false,
									priority: 'low',
									signal,
								});
								signal.throwIfAborted();
								if (page.hasNextPage && (!page.cursor || batch.visited.has(page.cursor)))
									throw appError('invalid-response', {
										message: 'collection-activity-pagination-stalled',
									});
								for (const event of page.events)
									events.set(event.id, mergeIndexedActivityEvent(events.get(event.id), event));
								if (page.hasNextPage) {
									batch.cursor = page.cursor;
									batch.visited.add(page.cursor!);
								} else batch.complete = true;
							}
						}
					} catch (cause) {
						if (!failed) failure = cause;
						failed = true;
					}
				})
			);
			signal.throwIfAborted();
			if (failed) throw failure;
			return globalActivityChartStats([...events.values()]);
		},
	};
}

function isCount(value: unknown): value is number {
	return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function field(value: unknown, name: string): unknown {
	return value && typeof value === 'object' ? (value as Record<string, unknown>)[name] : undefined;
}

// A cached summary is untrusted browser data: every count, the period, and every bucket is validated before reuse.
function isChartStats(value: unknown): value is GlobalActivityChartStats {
	const events = field(value, 'events');
	const listings = field(value, 'listings');
	const participants = field(value, 'participants');
	const buckets = field(value, 'buckets');
	if (!isCount(events) || !isCount(listings) || !isCount(participants)) return false;
	if (listings > events || participants > events) return false;
	if (typeof field(value, 'period') !== 'string') return false;
	if (!Array.isArray(buckets) || buckets.length > 30) return false;
	return buckets.every(
		(bucket) =>
			isCount(field(bucket, 'start')) &&
			isCount(field(bucket, 'events')) &&
			isCount(field(bucket, 'listings')) &&
			isCount(field(bucket, 'participants'))
	);
}

export function loadGlobalActivityStats(
	storage: StorageLike,
	scope: string,
	now = Date.now()
): GlobalActivityStatsSnapshot | null {
	try {
		const value: unknown = JSON.parse(storage.getItem(GLOBAL_ACTIVITY_STATS_STORAGE_KEY) ?? 'null');
		const savedAt = field(value, 'savedAt');
		if (
			field(value, 'version') !== 1 ||
			field(value, 'scope') !== scope ||
			typeof savedAt !== 'number' ||
			!Number.isFinite(savedAt) ||
			savedAt > now ||
			now - savedAt >= GLOBAL_ACTIVITY_STATS_MAX_AGE
		)
			return null;
		const stats = field(value, 'stats');
		if (!isChartStats(stats)) return null;
		return { scope, savedAt, stats };
	} catch {
		return null;
	}
}

export function saveGlobalActivityStats(storage: StorageLike, snapshot: GlobalActivityStatsSnapshot) {
	try {
		storage.setItem(GLOBAL_ACTIVITY_STATS_STORAGE_KEY, JSON.stringify({ version: 1, ...snapshot }));
	} catch {
		// Only a rebuildable summary; storage availability must not affect the feed.
	}
}
