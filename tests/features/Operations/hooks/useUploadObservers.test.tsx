// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { MintUploadTransaction } from 'api/mint';

import { useUploadObservers } from 'features/Operations/hooks/useUploadObservers';

import { renderHook } from '../../../test-utils/render-hook';

const mocks = vi.hoisted(() => ({
	loadRuntime: vi.fn(),
	acquire: vi.fn(),
	release: vi.fn(),
	watchers: [] as any[],
	ready: Promise.resolve(),
}));

vi.mock('api/transactions', async (importOriginal) => ({
	...(await importOriginal<typeof import('api/transactions')>()),
	loadAssetObserverRuntime: () => mocks.loadRuntime(),
}));

const FIRST = 'X'.repeat(43);
const SECOND = 'Y'.repeat(43);

function watcher(id: string) {
	const listeners: Record<string, Array<(value?: unknown) => void>> = { view: [], consensus: [] };
	const instance = {
		id,
		started: false,
		stopped: false,
		unsubscribed: 0,
		views: () => [{ observer: { label: id.slice(0, 2) } }],
		consensus: () => ({ state: 'confirmed', confirmations: 1 }),
		on(event: string, listener: (value?: unknown) => void) {
			listeners[event].push(listener);
			return () => {
				instance.unsubscribed += 1;
			};
		},
		emit(event: string, value?: unknown) {
			listeners[event].forEach((listener) => listener(value));
		},
		start() {
			instance.started = true;
		},
		stop() {
			instance.stopped = true;
		},
	};
	return instance;
}

function observerHook(transactions: MintUploadTransaction[], active: boolean) {
	return renderHook(
		(props: { transactions: MintUploadTransaction[]; active: boolean }) =>
			useUploadObservers(props.transactions, props.active),
		{ transactions, active }
	);
}

const TRANSACTIONS: MintUploadTransaction[] = [
	{ id: FIRST, label: 'Artwork transaction' },
	{ id: SECOND, label: 'Asset transaction' },
];

beforeEach(() => {
	mocks.watchers = [];
	mocks.release = vi.fn();
	mocks.acquire = vi.fn(() => ({
		ready: mocks.ready,
		release: mocks.release,
		network: {
			watch: (id: string) => {
				const created = watcher(id);
				mocks.watchers.push(created);
				return created;
			},
		},
	}));
	mocks.loadRuntime = vi.fn(async () => ({ acquireAssetObserverNetwork: mocks.acquire }));
});

describe('upload observers', () => {
	it('observes nothing while the panel is hidden or has no transactions', async () => {
		const hidden = observerHook(TRANSACTIONS, false);
		await hidden.flush(2);
		expect(mocks.loadRuntime).not.toHaveBeenCalled();
		hidden.unmount();

		const empty = observerHook([], true);
		await empty.flush(2);
		expect(mocks.loadRuntime).not.toHaveBeenCalled();
		empty.unmount();
	});

	it('watches every uploaded transaction and publishes their observations', async () => {
		const hook = observerHook(TRANSACTIONS, true);
		await hook.flush(2);

		expect(mocks.watchers.map((instance) => instance.id)).toEqual([FIRST, SECOND]);
		expect(mocks.watchers.every((instance) => instance.started)).toBe(true);

		hook.act(() => mocks.watchers[0].emit('view'));
		expect(hook.current()[FIRST]).toMatchObject({ consensus: { confirmations: 1 } });
		expect(hook.current()[SECOND]).toBeUndefined();

		hook.act(() => mocks.watchers[1].emit('consensus', { state: 'confirming', confirmations: 2 }));
		expect(hook.current()[SECOND]).toMatchObject({ consensus: { confirmations: 2 } });
		hook.unmount();
	});

	it('stops watching and releases the network when the panel closes', async () => {
		const hook = observerHook(TRANSACTIONS, true);
		await hook.flush(2);
		hook.rerender({ transactions: TRANSACTIONS, active: false });

		expect(mocks.watchers.every((instance) => instance.stopped)).toBe(true);
		expect(mocks.watchers.reduce((total, instance) => total + instance.unsubscribed, 0)).toBe(4);
		expect(mocks.release).toHaveBeenCalledTimes(1);
		hook.unmount();
	});

	it('releases the network when the panel closes before it is ready', async () => {
		let releaseReady!: () => void;
		mocks.ready = new Promise<void>((resolve) => {
			releaseReady = resolve;
		});
		const hook = observerHook(TRANSACTIONS, true);
		await hook.flush(1);
		hook.unmount();
		releaseReady();
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(mocks.watchers).toHaveLength(0);
		expect(mocks.release).toHaveBeenCalledTimes(1);
		mocks.ready = Promise.resolve();
	});
});
