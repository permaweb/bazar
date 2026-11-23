import { describe, expect, it, vi } from 'vitest';

import { loadAtomicTransactionRuntime, preloadAtomicTransactionRuntime } from './runtime';

// Counts factory runs so the tests see how often runtime.ts really imports.
// The first two imports fail like a dropped chunk request; later ones succeed.
const { AssetTransactionClient, imports } = vi.hoisted(() => ({
	AssetTransactionClient: class {},
	imports: { transactions: 0 },
}));

vi.mock('api/asset-transactions', () => {
	imports.transactions += 1;
	if (imports.transactions <= 2) throw new Error('chunk request failed');
	return { AssetTransactionClient };
});
// The sibling imports are stubbed only to keep the test light.
vi.mock('api/asset-observers', () => ({ acquireAssetObserverNetwork: () => undefined }));
vi.mock('weave-wrangler', () => ({ SwapPurchase: class {} }));

async function settle() {
	for (let tick = 0; tick < 5; tick += 1) await new Promise((resolve) => setTimeout(resolve, 0));
}

// runtime.ts keeps one module-level cache, so these tests run in order
// against a single import of it.
describe('atomic transaction runtime loading', () => {
	it('lets a failed preload go without an unhandled rejection', async () => {
		const unhandled: unknown[] = [];
		const onUnhandled = (reason: unknown) => unhandled.push(reason);
		process.on('unhandledRejection', onUnhandled);
		try {
			preloadAtomicTransactionRuntime();
			// Wait for the failing import itself, then let the rejection settle.
			await vi.waitFor(() => expect(imports.transactions).toBe(1));
			await settle();
		} finally {
			process.off('unhandledRejection', onUnhandled);
		}
		expect(imports.transactions).toBe(1);
		expect(unhandled).toEqual([]);
	});

	it('retries the import after a failed load instead of caching the rejection', async () => {
		await expect(loadAtomicTransactionRuntime()).rejects.toThrow();
		expect(imports.transactions).toBe(2);

		const runtime = await loadAtomicTransactionRuntime();
		expect(imports.transactions).toBe(3);
		expect(runtime.AssetTransactionClient).toBe(AssetTransactionClient);
	});

	it('keeps a successful load cached for the session', async () => {
		const first = await loadAtomicTransactionRuntime();
		await expect(loadAtomicTransactionRuntime()).resolves.toBe(first);
		expect(imports.transactions).toBe(3);
	});
});
