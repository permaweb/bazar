let atomicRuntime: Promise<AtomicTransactionRuntime> | undefined;

export type AtomicTransactionRuntime = Awaited<ReturnType<typeof importAtomicTransactionRuntime>>;

async function importAtomicTransactionRuntime() {
	const [transactions, observers, observerOptions, wrangler] = await Promise.all([
		import('api/asset-transactions'),
		import('api/arweave-observers'),
		import('api/asset-observers'),
		import('weave-wrangler'),
	]);
	return {
		...transactions,
		ArweaveObserverNetwork: observers.ArweaveObserverNetwork,
		assetObserverNetworkOptions: observerOptions.assetObserverNetworkOptions,
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
