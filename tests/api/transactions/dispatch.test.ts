import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const control = vi.hoisted(() => ({
	dispatchAborted: false,
	networkOptions: undefined as Record<string, unknown> | undefined,
	networkStopped: false,
	watcherStopped: false,
	outcome: 'timeout' as 'timeout' | 'settled' | 'pending',
	listeners: new Map<string, (...args: any[]) => void>(),
}));

vi.mock('api/observers/network', () => ({
	ArweaveObserverNetwork: class {
		constructor(options: Record<string, unknown>) {
			control.networkOptions = options;
		}
		async ready() {}
		watch() {
			return {
				on(event: string, listener: (...args: any[]) => void) {
					control.listeners.set(event, listener);
					return () => control.listeners.delete(event);
				},
				start() {
					queueMicrotask(() => {
						if (control.outcome === 'pending') return;
						if (control.outcome === 'timeout') control.listeners.get('timeout')?.();
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
							control.listeners.get('consensus')?.(consensus);
							control.listeners.get('settled')?.(consensus);
						}
					});
				},
				stop() {
					control.watcherStopped = true;
				},
				views: () => [],
				consensus: () => ({ seen: 0 }),
			};
		}
		stop() {
			control.networkStopped = true;
		}
	},
}));

import { TransactionDispatchRejectedError } from 'weave-wrangler';

import { dispatchAndConfirm } from 'api/transactions/adapter';

describe('transaction dispatch observation', () => {
	afterEach(() => vi.unstubAllGlobals());

	beforeEach(() => {
		control.dispatchAborted = false;
		control.networkOptions = undefined;
		control.networkStopped = false;
		control.watcherStopped = false;
		control.outcome = 'timeout';
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

	it('reports an unseen submitted transaction as an unknown outcome that keeps its ID', async () => {
		const transaction = {
			id: 'qAhWNMSuX70lZpIRohKJn_SuVcymr_RmpGbltydjpwA',
			dispatch: async () => undefined,
		};

		await expect(dispatchAndConfirm(transaction as any)).rejects.toMatchObject({
			reason: 'transaction-propagation-timeout',
			code: 'unknown-outcome',
			retryable: false,
			detail: { transactionId: transaction.id },
		});
	});

	it('reports a definitive gateway refusal as a rejected dispatch of the exact signed transaction', async () => {
		control.outcome = 'pending';
		const transaction = {
			id: 'qAhWNMSuX70lZpIRohKJn_SuVcymr_RmpGbltydjpwA',
			dispatch: async () => {
				throw new TransactionDispatchRejectedError(400, 'transaction-dispatch-400');
			},
		};

		await expect(dispatchAndConfirm(transaction as any)).rejects.toMatchObject({
			reason: 'transaction-dispatch-rejected',
			code: 'rejected',
			detail: { transactionId: transaction.id },
		});
	});
});
