import React from 'react';

import type { MintUploadTransaction } from 'api/mint';
import type { AssetObserverNetworkLease } from 'api/observers';
import { loadAssetObserverRuntime } from 'api/transactions';

import type { UploadObserverState } from 'providers/OperationActivityProvider';

/**
 * Watches each uploaded transaction through the shared asset observer network while the upload panel is visible and
 * its work is still running. Watchers, listeners, and the network lease are released when the panel hides, the work
 * finishes, or the transaction list changes.
 */
export function useUploadObservers(transactions: MintUploadTransaction[], active: boolean): UploadObserverState {
	const [observerState, setObserverState] = React.useState<UploadObserverState>({});

	React.useEffect(() => {
		if (!active || !transactions.length) return;
		let cancelled = false;
		let lease: AssetObserverNetworkLease | undefined;
		const watchers: Array<{ stop(): void }> = [];
		const unsubscribe: Array<() => void> = [];
		const observe = async () => {
			const runtime = await loadAssetObserverRuntime();
			if (cancelled) return;
			lease = runtime.acquireAssetObserverNetwork();
			await lease.ready;
			if (cancelled) return;
			for (const transaction of transactions) {
				const watcher = lease.network.watch(transaction.id, {
					target: 1,
					minObservers: 3,
					propagation: 'all',
					notFoundTimeout: 180_000,
				});
				const publish = (consensus = watcher.consensus()) => {
					if (cancelled) return;
					setObserverState((current) => ({
						...current,
						[transaction.id]: { views: watcher.views(), consensus },
					}));
				};
				unsubscribe.push(
					watcher.on('view', () => publish()),
					watcher.on('consensus', publish)
				);
				watchers.push(watcher);
				watcher.start();
			}
		};
		void observe().catch(() => {
			lease?.release();
			lease = undefined;
		});
		return () => {
			cancelled = true;
			for (const off of unsubscribe) off();
			for (const watcher of watchers) watcher.stop();
			lease?.release();
		};
	}, [active, transactions]);

	return observerState;
}
