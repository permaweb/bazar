import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ readAssetState: vi.fn() }));

vi.mock('./asset-marketplace', () => ({
	readAssetState: mocks.readAssetState,
	servingNodeOrigin: () => 'https://node.example',
}));

import { clearAssetStateCache, readAssetStateCached } from './asset-state-store';

const processId = 'P'.repeat(43);
const result = {
	state: { raw: {}, totalSupply: '1' },
	provider: 'https://node.example',
	verifiedAt: 1,
	maxAge: 20,
} as any;

describe('asset state store', () => {
	beforeEach(() => {
		clearAssetStateCache();
		mocks.readAssetState.mockReset();
		mocks.readAssetState.mockResolvedValue(result);
	});

	it('deduplicates concurrent reads and reuses a fresh result', async () => {
		await Promise.all([readAssetStateCached(processId), readAssetStateCached(processId)]);
		await readAssetStateCached(processId);
		expect(mocks.readAssetState).toHaveBeenCalledTimes(1);
	});

	it('keeps cached compute reads separate from fresh now reads', async () => {
		await readAssetStateCached(processId, { mode: 'compute' });
		await readAssetStateCached(processId);

		expect(mocks.readAssetState).toHaveBeenCalledTimes(2);
		expect(mocks.readAssetState).toHaveBeenNthCalledWith(
			1,
			processId,
			expect.objectContaining({ mode: 'compute' })
		);
		expect(mocks.readAssetState).toHaveBeenNthCalledWith(
			2,
			processId,
			expect.objectContaining({ mode: undefined })
		);
	});

	it('can force a commerce-safe revalidation', async () => {
		await readAssetStateCached(processId);
		await readAssetStateCached(processId, { force: true, maxAge: 0 });
		expect(mocks.readAssetState).toHaveBeenCalledTimes(2);
		expect(mocks.readAssetState).toHaveBeenLastCalledWith(processId, expect.objectContaining({ maxAge: 0 }));
	});

	it('lets a feed consumer stop waiting without cancelling the shared read', async () => {
		vi.useFakeTimers();
		let finishRead!: (value: typeof result) => void;
		mocks.readAssetState.mockReturnValue(
			new Promise((resolve) => {
				finishRead = resolve;
			})
		);
		try {
			const bounded = readAssetStateCached(processId, { waitTimeoutMs: 25 });
			const patient = readAssetStateCached(processId);
			const rejection = expect(bounded).rejects.toThrow('asset-state-read-timeout');
			await vi.advanceTimersByTimeAsync(25);
			await rejection;

			finishRead(result);
			await expect(patient).resolves.toBe(result);
			expect(mocks.readAssetState).toHaveBeenCalledTimes(1);
		} finally {
			vi.useRealTimers();
		}
	});
});
