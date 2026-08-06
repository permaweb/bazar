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

	it('can force a commerce-safe revalidation', async () => {
		await readAssetStateCached(processId);
		await readAssetStateCached(processId, { force: true, maxAge: 0 });
		expect(mocks.readAssetState).toHaveBeenCalledTimes(2);
		expect(mocks.readAssetState).toHaveBeenLastCalledWith(processId, expect.objectContaining({ maxAge: 0 }));
	});
});
