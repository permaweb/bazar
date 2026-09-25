let atomicRuntime: Promise<AtomicTransactionRuntime> | undefined;
let observerRuntime: Promise<typeof import('api/observers/assets')> | undefined;
export type AtomicTransactionRuntime = Awaited<ReturnType<typeof importAtomicTransactionRuntime>>;

async function importAtomicTransactionRuntime() {
	const [transactions, observerOptions, wrangler] = await Promise.all([
		import('./adapter'),
		import('api/observers/assets'),
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

export function loadAssetObserverRuntime() {
	observerRuntime ??= import('api/observers/assets').catch((cause) => {
		observerRuntime = undefined;
		throw cause;
	});
	return observerRuntime;
}
