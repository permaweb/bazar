import {
	type CollectionActivityEvent,
	type CollectionActivityPageOptions,
	discoverCollectionActivityPage,
} from 'api/asset-discovery';

import { type GlobalActivityChartStats, globalActivityChartStats } from 'components/GlobalActivityCharts';
import { GLOBAL_ACTIVITY_STATS_STORAGE_KEY } from 'helpers/browser-storage';

import { mergeIndexedActivityEvent } from './global-activity';

export const GLOBAL_ACTIVITY_STATS_MAX_AGE = 5 * 60_000;
type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;
export type GlobalActivityStatsSnapshot = { scope: string; savedAt: number; stats: GlobalActivityChartStats };

/** Independent history reader with a small worker pool and resumable failed pages. */
export function createGlobalActivityStatsScan(
	recipients: string[],
	options: Pick<CollectionActivityPageOptions, 'fetch' | 'graphql' | 'requestTimeoutMs'> = {}
) {
	const ids = [...new Set(recipients.filter((id) => /^[A-Za-z0-9_-]{43}$/.test(id)))].sort();
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
									throw new Error('collection-activity-pagination-limit');
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
									throw new Error('collection-activity-pagination-stalled');
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

export function loadGlobalActivityStats(
	storage: StorageLike,
	scope: string,
	now = Date.now()
): GlobalActivityStatsSnapshot | null {
	try {
		const value = JSON.parse(storage.getItem(GLOBAL_ACTIVITY_STATS_STORAGE_KEY) ?? 'null');
		if (
			!value ||
			value.version !== 1 ||
			value.scope !== scope ||
			!Number.isFinite(value.savedAt) ||
			value.savedAt > now ||
			now - value.savedAt >= GLOBAL_ACTIVITY_STATS_MAX_AGE
		)
			return null;
		const stats = value.stats;
		const count = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
		if (
			!stats ||
			!count(stats.events) ||
			!count(stats.listings) ||
			!count(stats.participants) ||
			stats.listings > stats.events ||
			stats.participants > stats.events ||
			typeof stats.period !== 'string' ||
			!Array.isArray(stats.buckets) ||
			stats.buckets.length > 30 ||
			stats.buckets.some(
				(bucket: any) =>
					!bucket ||
					!count(bucket.start) ||
					!count(bucket.events) ||
					!count(bucket.listings) ||
					!count(bucket.participants)
			)
		)
			return null;
		return { scope, savedAt: value.savedAt, stats };
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
