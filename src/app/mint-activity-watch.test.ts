import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MINT_ACTIVITY_ATTENTION_AFTER_MS, type MintActivity } from 'api/mint-activity';

const readAssetState = vi.hoisted(() => vi.fn());

vi.mock('api/asset-marketplace', async (importOriginal) => ({
	...(await importOriginal<typeof import('api/asset-marketplace')>()),
	readAssetState,
}));

import { observeMintActivity } from './App';

const processId = 'P'.repeat(43);
const owner = 'O'.repeat(43);
const now = 1_800_000_000_000;

function activity(overrides: Partial<MintActivity> = {}): MintActivity {
	return {
		id: `mint:${owner}:${processId}`,
		owner,
		asset: {
			id: processId,
			name: 'Signal',
			description: '',
			contentType: 'image/png',
			image: processId,
			mediaId: processId,
			owner,
			createdAt: now,
		},
		collectionId: 'created-assets',
		transactionIds: [processId],
		arweaveGateway: 'https://gateway.example',
		computeGateway: 'https://compute.example',
		phase: 'mined',
		status: 'Mined on Arweave. Waiting for live process state.',
		createdAt: now,
		...overrides,
	};
}

describe('background mint observation', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(now);
		vi.stubGlobal('window', globalThis);
		readAssetState.mockReset();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.useRealTimers();
	});

	it('still reaches complete when live state appears after the attention threshold', async () => {
		readAssetState
			.mockRejectedValueOnce(new Error('not yet'))
			.mockRejectedValueOnce(new Error('not yet'))
			.mockResolvedValue({});
		const phases: string[] = [];
		const controller = new AbortController();
		const stalled = activity({ createdAt: now - MINT_ACTIVITY_ATTENTION_AFTER_MS - 60_000 });

		const watch = observeMintActivity(stalled, (phase) => phases.push(phase), controller.signal);
		await vi.advanceTimersByTimeAsync(0);
		expect(readAssetState).toHaveBeenCalledTimes(1);

		// Stalled watches slow to about once a minute rather than stopping.
		await vi.advanceTimersByTimeAsync(4_000);
		expect(readAssetState).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(56_000);
		expect(readAssetState).toHaveBeenCalledTimes(2);
		await vi.advanceTimersByTimeAsync(60_000);
		await watch;

		expect(readAssetState).toHaveBeenCalledTimes(3);
		expect(phases).toEqual(['applied', 'complete']);
		expect(controller.signal.aborted).toBe(false);
	});

	it('slows a running watch once it crosses the threshold', async () => {
		readAssetState.mockRejectedValue(new Error('not yet'));
		const controller = new AbortController();
		const watch = observeMintActivity(
			activity({ createdAt: now - MINT_ACTIVITY_ATTENTION_AFTER_MS + 6_000 }),
			() => undefined,
			controller.signal
		).catch(() => undefined);
		await vi.advanceTimersByTimeAsync(0);
		await vi.advanceTimersByTimeAsync(4_000);
		expect(readAssetState).toHaveBeenCalledTimes(2);
		await vi.advanceTimersByTimeAsync(4_000);
		expect(readAssetState).toHaveBeenCalledTimes(3);
		// Now past 30 minutes: the next check waits the slower interval.
		await vi.advanceTimersByTimeAsync(4_000);
		expect(readAssetState).toHaveBeenCalledTimes(3);
		await vi.advanceTimersByTimeAsync(56_000);
		expect(readAssetState).toHaveBeenCalledTimes(4);

		controller.abort();
		await watch;
	});
});
