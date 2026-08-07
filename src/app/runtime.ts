let atomicRuntime: Promise<AtomicTransactionRuntime> | undefined;

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
