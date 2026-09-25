// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Collection } from 'api/collections';

import { useHomeCollectionActivity } from 'features/Home/hooks/useHomeCollectionActivity';

import { renderHook } from '../../../test-utils/render-hook';

const discoverCollectionActivityBatched = vi.hoisted(() => vi.fn());

vi.mock('api/discovery', async (importOriginal) => ({
	...(await importOriginal<typeof import('api/discovery')>()),
	discoverCollectionActivityBatched,
}));

function collection(letter: string): Collection {
	return {
		id: letter.repeat(43),
		title: `Collection ${letter}`,
		assets: [{ id: letter.repeat(43) }],
	} as unknown as Collection;
}

const COLLECTIONS = [collection('A'), collection('B'), collection('C'), collection('D')];

let unhandled: unknown[] = [];

function recordUnhandled(reason: unknown) {
	unhandled.push(reason);
}

/** Node reports an unhandled rejection a tick after the microtask queue drains. */
async function settleRejections() {
	await new Promise((resolve) => setTimeout(resolve, 0));
	await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('useHomeCollectionActivity', () => {
	beforeEach(() => {
		unhandled = [];
		process.on('unhandledRejection', recordUnhandled);
	});

	afterEach(() => {
		process.off('unhandledRejection', recordUnhandled);
		vi.clearAllMocks();
	});

	it('publishes the latest indexed action per collection', async () => {
		discoverCollectionActivityBatched.mockImplementation(({ recipients }: { recipients: string[] }) =>
			Promise.resolve([{ id: `${recipients[0]}-event`, timestamp: 10 }])
		);
		const onActivity = vi.fn();
		const hook = renderHook(useHomeCollectionActivity, {
			active: true,
			collections: [COLLECTIONS[0]],
			onActivity,
		});
		await hook.flush();

		expect(onActivity).toHaveBeenCalledWith({
			collectionId: COLLECTIONS[0].id,
			activity: { id: `${COLLECTIONS[0].id}-event`, timestamp: 10 },
		});
		hook.unmount();
	});

	it('settles quietly when an unmount aborts the scan mid-read', async () => {
		const aborts: Promise<never>[] = [];
		discoverCollectionActivityBatched.mockImplementation(
			({ signal }: { signal: AbortSignal }) =>
				new Promise<never>((_resolve, reject) => {
					signal.addEventListener('abort', () => reject(signal.reason), { once: true });
				})
		);
		const onActivity = vi.fn();
		const hook = renderHook(useHomeCollectionActivity, { active: true, collections: COLLECTIONS, onActivity });

		hook.unmount();
		await settleRejections();
		await Promise.allSettled(aborts);

		expect(unhandled).toEqual([]);
		expect(onActivity).not.toHaveBeenCalled();
	});

	it('leaves the remaining collections unread after an abort', async () => {
		discoverCollectionActivityBatched.mockImplementation(
			({ signal }: { signal: AbortSignal }) =>
				new Promise<never>((_resolve, reject) => {
					signal.addEventListener('abort', () => reject(signal.reason), { once: true });
				})
		);
		const hook = renderHook(useHomeCollectionActivity, {
			active: true,
			collections: COLLECTIONS,
			onActivity: vi.fn(),
		});

		hook.unmount();
		await settleRejections();

		// Two workers were in flight; the other two collections are skipped rather than requested.
		expect(discoverCollectionActivityBatched).toHaveBeenCalledTimes(2);
		expect(unhandled).toEqual([]);
	});

	it('keeps creation time as the fallback when indexing fails', async () => {
		discoverCollectionActivityBatched.mockRejectedValue(new Error('index-unavailable'));
		const onActivity = vi.fn();
		const hook = renderHook(useHomeCollectionActivity, {
			active: true,
			collections: [COLLECTIONS[0], COLLECTIONS[1]],
			onActivity,
		});
		await hook.flush();
		await settleRejections();

		expect(onActivity).not.toHaveBeenCalled();
		expect(unhandled).toEqual([]);
		hook.unmount();
	});
});
