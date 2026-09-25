// @vitest-environment jsdom
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ARWEAVE_OBSERVER_RESPONSE_EVENT, type ArweaveObserverResponseDetail } from 'api/observers';
import type { Observer } from 'api/transactions';

import type { ArweaveSyncStep } from 'features/TransactionSync';
import { useLiveObserverResponses } from 'features/TransactionSync/hooks/useLiveObserverResponses';
import { readCachedObserverViews } from 'features/TransactionSync/model/observerViews';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const transactionId = 'P'.repeat(43);
const otherTransactionId = 'Q'.repeat(43);
const observer: Observer = { url: 'https://observer.example', label: 'observer', source: 'peer', failures: 0 };

function step(id = transactionId): ArweaveSyncStep {
	return { key: 'pay', label: 'Pay seller', target: 5, transaction: { id, views: [] } };
}

function respond(overrides: Partial<ArweaveObserverResponseDetail> = {}) {
	const detail: ArweaveObserverResponseDetail = {
		transactionId,
		observer,
		observedAt: 100,
		status: 202,
		latency: 20,
		...overrides,
	};
	window.dispatchEvent(new CustomEvent(ARWEAVE_OBSERVER_RESPONSE_EVENT, { detail }));
}

let root: Root;
let observed: ArweaveSyncStep[] = [];

function Probe(props: { steps: ArweaveSyncStep[] }) {
	observed = useLiveObserverResponses(props.steps);
	return null;
}

function render(steps: ArweaveSyncStep[]) {
	React.act(() => root.render(<Probe steps={steps} />));
}

async function flushBatch() {
	await React.act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 60));
	});
}

describe('useLiveObserverResponses', () => {
	beforeEach(() => {
		window.sessionStorage.clear();
		root = createRoot(document.createElement('div'));
		observed = [];
	});

	afterEach(() => {
		React.act(() => root.unmount());
	});

	it('merges batched live responses into the observed step and caches them', async () => {
		render([step()]);
		expect(observed[0].transaction?.views).toEqual([]);

		respond();
		respond({ observedAt: 120, status: 200, body: { number_of_confirmations: 2, block_indep_hash: 'block' } });
		expect(observed[0].transaction?.views).toEqual([]);
		await flushBatch();

		expect(observed[0].transaction?.views).toHaveLength(1);
		expect(observed[0].transaction?.views[0]).toMatchObject({ state: 'confirmed', confirmations: 2 });
		expect(readCachedObserverViews(window.sessionStorage, transactionId)).toHaveLength(1);
	});

	it('ignores responses for transactions the sequence is not watching', async () => {
		render([step()]);
		respond({ transactionId: otherTransactionId });
		await flushBatch();

		expect(observed[0].transaction?.views).toEqual([]);
	});

	it('restores a transaction’s cached views when the sequence is mounted again', async () => {
		render([step()]);
		respond();
		await flushBatch();
		React.act(() => root.unmount());

		root = createRoot(document.createElement('div'));
		render([step()]);
		expect(observed[0].transaction?.views).toHaveLength(1);
	});

	it('stops listening after unmount', async () => {
		const remove = vi.spyOn(window, 'removeEventListener');
		render([step()]);
		React.act(() => root.unmount());

		expect(remove).toHaveBeenCalledWith(ARWEAVE_OBSERVER_RESPONSE_EVENT, expect.any(Function));
		root = createRoot(document.createElement('div'));
		remove.mockRestore();
	});
});
