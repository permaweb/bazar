import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { connectPermawebOsTestWallet } from '../test/permaweb-os';

const control = vi.hoisted(() => ({
	dispatchAborted: false,
	networkOptions: undefined as Record<string, unknown> | undefined,
	networkStopped: false,
	watcherStopped: false,
	// 'pending' fires nothing from start(), so a test drives the watcher itself.
	outcome: 'timeout' as 'timeout' | 'settled' | 'pending',
	seen: 0,
	// A Set per event: dispatchAndConfirm's settlement and waitUntilSeen both
	// subscribe to 'consensus', and one must not replace or remove the other.
	listeners: new Map<string, Set<(...args: any[]) => void>>(),
	emit(event: string, ...args: any[]) {
		for (const listener of [...(this.listeners.get(event) ?? [])]) listener(...args);
	},
}));

vi.mock('./arweave-observers', () => ({
	ArweaveObserverNetwork: class {
		constructor(options: Record<string, unknown>) {
			control.networkOptions = options;
		}
		async ready() {}
		// A healthy network: enough reachable observers for a quorum.
		active() {
			return [{}, {}, {}];
		}
		watch() {
			return {
				on(event: string, listener: (...args: any[]) => void) {
					let listeners = control.listeners.get(event);
					if (!listeners) control.listeners.set(event, (listeners = new Set()));
					listeners.add(listener);
					return () => listeners.delete(listener);
				},
				start() {
					queueMicrotask(() => {
						if (control.outcome === 'pending') return;
						if (control.outcome === 'timeout') control.emit('timeout');
						else {
							const consensus = {
								state: 'confirmed',
								confirmations: 5,
								answering: 3,
								eligible: 3,
								agreeing: 3,
								quorum: 2,
								best: 5,
								seen: 3,
								propagated: true,
								blockId: 'block',
								blockHeight: 12,
								settled: true,
							};
							control.emit('consensus', consensus);
							control.emit('settled', consensus);
						}
					});
				},
				stop() {
					control.watcherStopped = true;
				},
				views: () => [],
				consensus: () => ({ seen: control.seen }),
			};
		}
		stop() {
			control.networkStopped = true;
		}
	},
}));

import { TransactionDispatchNotSentError, TransactionDispatchRejectedError } from 'weave-wrangler';

import { dispatchAndConfirm } from './asset-transactions';

const TX_ID = 'qAhWNMSuX70lZpIRohKJn_SuVcymr_RmpGbltydjpwA';

/** Track a promise's settlement without awaiting it, so fake time can advance. */
function track<T>(promise: Promise<T>) {
	const state = { status: 'pending' as 'pending' | 'resolved' | 'rejected', error: undefined as unknown };
	promise.then(
		() => {
			state.status = 'resolved';
		},
		(error) => {
			state.status = 'rejected';
			state.error = error;
		}
	);
	return state;
}

describe('transaction dispatch observation', () => {
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	beforeEach(() => {
		control.dispatchAborted = false;
		control.networkOptions = undefined;
		control.networkStopped = false;
		control.watcherStopped = false;
		control.outcome = 'timeout';
		control.seen = 0;
		control.listeners.clear();
		const aoFetch = vi.fn(async () => new Response()) as unknown as PermawebOsAoFetch;
		Object.defineProperty(aoFetch, 'peers', { value: ['https://permawebos-peer.example'] });
		aoFetch.invalidate = vi.fn(async () => undefined);
		aoFetch.cacheMetadata = vi.fn(() => undefined);
		aoFetch.ready = vi.fn(async () => aoFetch.peers);
		vi.stubGlobal('window', {
			aoFetch,
			location: {
				protocol: 'https:',
				hostname: 'lcno4nkkk4gsb5krqpa6irlzbuurmnzk4entikswauifsbryldfa.arweave.net',
				port: '',
				search: '',
				hash: '',
			},
		});
		connectPermawebOsTestWallet();
	});

	it('relays deployment observer requests through the default HyperBEAM gateway', async () => {
		const transaction = {
			id: 'qAhWNMSuX70lZpIRohKJn_SuVcymr_RmpGbltydjpwA',
			dispatch: async () => undefined,
		};

		await expect(dispatchAndConfirm(transaction as any)).rejects.toThrow('transaction-propagation-timeout');
		expect(control.networkOptions).toMatchObject({
			node: 'https://lcno4nkkk4gsb5krqpa6irlzbuurmnzk4entikswauifsbryldfa.arweave.net',
			minObservers: 3,
			maxObservers: 7,
			'relay-with': 'https://permawebos-peer.example',
			fetch: expect.any(Function),
		});
	});

	it('terminates a hung dispatch when transaction observation times out', async () => {
		const transaction = {
			id: 'qAhWNMSuX70lZpIRohKJn_SuVcymr_RmpGbltydjpwA',
			dispatch: (signal: AbortSignal) =>
				new Promise<void>((_resolve, reject) => {
					signal.addEventListener(
						'abort',
						() => {
							control.dispatchAborted = true;
							reject(signal.reason);
						},
						{ once: true }
					);
				}),
		};

		await expect(dispatchAndConfirm(transaction as any)).rejects.toThrow('transaction-propagation-timeout');
		expect(control.dispatchAborted).toBe(true);
		expect(control.watcherStopped).toBe(true);
		expect(control.networkStopped).toBe(true);
	});

	it('reports the exact watcher consensus used to settle the transaction', async () => {
		control.outcome = 'settled';
		const consensuses: any[] = [];
		const progress: any[] = [];
		const transaction = {
			id: 'qAhWNMSuX70lZpIRohKJn_SuVcymr_RmpGbltydjpwA',
			dispatch: async () => undefined,
		};

		await dispatchAndConfirm(transaction as any, {
			onConsensus: (consensus) => consensuses.push(consensus),
			onProgress: (update) => progress.push(update),
		});

		expect(consensuses).toHaveLength(1);
		expect(consensuses[0]).toMatchObject({
			state: 'confirmed',
			confirmations: 5,
			blockId: 'block',
			blockHeight: 12,
			settled: true,
		});
		expect(progress).toEqual([{ confirmations: 5, propagated: true, seen: 3, eligible: 3 }]);
	});

	describe('dispatch retry rules', () => {
		// Aborting after each case releases the shared observer lease even when a
		// regression leaves a dispatch loop running, so one failure stays local.
		let controller: AbortController;
		const confirm = (dispatch: (signal: AbortSignal) => Promise<void>) =>
			track(dispatchAndConfirm({ id: TX_ID, dispatch } as any, { signal: controller.signal }));

		beforeEach(() => {
			vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
			control.outcome = 'pending';
			controller = new AbortController();
		});

		afterEach(async () => {
			controller.abort();
			await vi.advanceTimersByTimeAsync(0);
		});

		it('re-posts an ambiguous failure once after 15 s unseen, then throws after the second 15 s wait', async () => {
			const dispatch = vi.fn(async () => {
				throw new Error('transaction-dispatch-503');
			});
			const result = confirm(dispatch);

			await vi.advanceTimersByTimeAsync(14_999);
			expect(dispatch).toHaveBeenCalledTimes(1);
			expect(result.status).toBe('pending');

			await vi.advanceTimersByTimeAsync(1);
			expect(dispatch).toHaveBeenCalledTimes(2);
			expect(result.status).toBe('pending');

			await vi.advanceTimersByTimeAsync(14_999);
			expect(result.status).toBe('pending');

			await vi.advanceTimersByTimeAsync(1);
			expect(result.status).toBe('rejected');
			expect((result.error as Error).message).toBe('transaction-dispatch-503');

			await vi.advanceTimersByTimeAsync(60_000);
			expect(dispatch).toHaveBeenCalledTimes(2);
			expect(control.watcherStopped).toBe(true);
			expect(control.networkStopped).toBe(true);
		});

		it('never re-posts a transaction the endpoint reports as not sent', async () => {
			const dispatch = vi.fn(async () => {
				throw new TransactionDispatchNotSentError('offline');
			});
			const result = confirm(dispatch);

			await vi.advanceTimersByTimeAsync(0);
			expect(result.status).toBe('rejected');
			expect(result.error).toMatchObject({ code: 'transaction-dispatch-not-sent' });

			await vi.advanceTimersByTimeAsync(60_000);
			expect(dispatch).toHaveBeenCalledTimes(1);
			expect(control.watcherStopped).toBe(true);
			expect(control.networkStopped).toBe(true);
		});

		it('never re-posts a transaction the endpoint rejected, and keeps the rejected code', async () => {
			const dispatch = vi.fn(async () => {
				throw new TransactionDispatchRejectedError(400, 'invalid signature');
			});
			const result = confirm(dispatch);

			await vi.advanceTimersByTimeAsync(0);
			expect(result.status).toBe('rejected');
			expect(result.error).toMatchObject({ code: 'transaction-dispatch-rejected', httpStatus: 400 });

			await vi.advanceTimersByTimeAsync(60_000);
			expect(dispatch).toHaveBeenCalledTimes(1);
			expect(control.watcherStopped).toBe(true);
			expect(control.networkStopped).toBe(true);
		});

		it('does not re-post an ambiguous failure once observers see the transaction, and waits for settlement', async () => {
			const dispatch = vi.fn(async () => {
				throw new Error('transaction-dispatch-503');
			});
			const result = confirm(dispatch);

			await vi.advanceTimersByTimeAsync(5_000);
			expect(dispatch).toHaveBeenCalledTimes(1);

			control.seen = 1;
			control.emit('consensus', { seen: 1, confirmations: 0, propagated: false, eligible: 3 });
			await vi.advanceTimersByTimeAsync(60_000);
			expect(dispatch).toHaveBeenCalledTimes(1);
			expect(result.status).toBe('pending');
			expect(control.watcherStopped).toBe(false);

			control.emit('settled');
			await vi.advanceTimersByTimeAsync(0);
			expect(result.status).toBe('resolved');
			expect(dispatch).toHaveBeenCalledTimes(1);
			expect(control.watcherStopped).toBe(true);
			expect(control.networkStopped).toBe(true);
		});

		it('does not wait or re-post when the transaction was already seen before the ambiguous failure', async () => {
			control.seen = 1;
			const dispatch = vi.fn(async () => {
				throw new Error('transaction-dispatch-timeout');
			});
			const result = confirm(dispatch);

			await vi.advanceTimersByTimeAsync(60_000);
			expect(dispatch).toHaveBeenCalledTimes(1);
			expect(result.status).toBe('pending');

			control.emit('settled');
			await vi.advanceTimersByTimeAsync(0);
			expect(result.status).toBe('resolved');
			expect(dispatch).toHaveBeenCalledTimes(1);
		});
	});
});
