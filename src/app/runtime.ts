let atomicRuntime: Promise<AtomicTransactionRuntime> | undefined;
let transactionSyncRuntime: Promise<typeof import('components/ArweaveTransactionSync')> | undefined;

export type AtomicTransactionRuntime = Awaited<ReturnType<typeof importAtomicTransactionRuntime>>;

async function importAtomicTransactionRuntime() {
	const [transactions, observerOptions, wrangler] = await Promise.all([
		import('api/asset-transactions'),
		import('api/asset-observers'),
		import('weave-wrangler'),
	]);
	return {
		...transactions,
		acquireAssetObserverNetwork: observerOptions.acquireAssetObserverNetwork,
		SwapPurchase: wrangler.SwapPurchase,
	};
}

export function loadAtomicTransactionRuntime() {
	atomicRuntime ??= importAtomicTransactionRuntime();
	return atomicRuntime;
}

export function preloadAtomicTransactionRuntime() {
	void loadAtomicTransactionRuntime();
}

export function loadArweaveTransactionSync() {
	transactionSyncRuntime ??= import('components/ArweaveTransactionSync').catch((cause) => {
		transactionSyncRuntime = undefined;
		throw cause;
	});
	return transactionSyncRuntime;
}

export function preloadArweaveTransactionSync() {
	void loadArweaveTransactionSync().catch(() => undefined);
}
