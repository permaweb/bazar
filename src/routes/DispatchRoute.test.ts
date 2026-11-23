import { describe, expect, it, vi } from 'vitest';

import type { AssetState } from 'api/asset-marketplace';
import { DISPLAY_STATE_TIMEOUT_ERROR } from 'api/asset-state-store';
import { DISPATCH_SIGNED_TRANSACTION_RECOVERY_REQUIRED, type DispatchPlan, runDispatch } from 'api/fungible-dispatch';

import {
	dispatchEndActivity,
	dispatchErrorMessage,
	type DispatchStartRequest,
	startDispatchOnce,
} from './DispatchRoute';

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (cause: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

const PROCESS = 'P'.repeat(43);
const SENDER = 'S'.repeat(43);
const ROWS = [
	{ address: 'A'.repeat(43), quantity: '1' },
	{ address: 'B'.repeat(43), quantity: '2' },
];
const STATE: AssetState = {
	device: 'token',
	name: 'Signal',
	ticker: 'SIG',
	denomination: 0,
	totalSupply: '100',
	balances: { [SENDER]: '100' },
	holderBalancesAvailable: true,
	orders: {},
	swapHeight: 0,
	value: null,
	raw: {},
};
const PLAN: DispatchPlan = {
	processId: PROCESS,
	sender: SENDER,
	createdAt: 1,
	baseline: {},
	rows: ROWS.map((row) => ({ ...row, status: 'unsent' as const })),
};

function harness(overrides: Partial<DispatchStartRequest> = {}) {
	const balance = deferred<bigint>();
	const created = deferred<DispatchPlan>();
	const preparing: boolean[] = [];
	const request: DispatchStartRequest = {
		inFlight: { current: false },
		abortRef: { current: null },
		processId: PROCESS,
		sender: SENDER,
		rows: ROWS,
		state: STATE,
		requiredWinston: 10n,
		readWalletBalance: vi.fn(() => balance.promise),
		createPlan: vi.fn(() => created.promise),
		execute: vi.fn(async () => undefined),
		onPreparingChange: vi.fn((value: boolean) => void preparing.push(value)),
		onPlan: vi.fn(),
		onError: vi.fn(),
		...overrides,
	};
	return { request, balance, created, preparing };
}

describe('dispatch start single flight', () => {
	it('turns a second submit during the pre-flight into a no-op so every transfer is signed once', async () => {
		const { request, balance, created } = harness();

		const first = startDispatchOnce(request);
		const second = startDispatchOnce(request);
		await expect(second).resolves.toBe('busy');

		balance.resolve(100n);
		created.resolve(PLAN);
		await expect(first).resolves.toBe('executed');

		expect(request.readWalletBalance).toHaveBeenCalledTimes(1);
		expect(request.createPlan).toHaveBeenCalledTimes(1);
		expect(request.onPlan).toHaveBeenCalledTimes(1);
		expect(request.execute).toHaveBeenCalledTimes(1);
		expect(request.inFlight.current).toBe(false);
	});

	it('claims the gate and the preparing state before the first await', () => {
		const { request, preparing } = harness();

		void startDispatchOnce(request);

		expect(request.inFlight.current).toBe(true);
		expect(preparing).toEqual([true]);
		expect(request.abortRef.current).toBeInstanceOf(AbortController);
	});

	it('hands its own controller to execute and threads the signal through the pre-flight reads', async () => {
		const { request, balance, created } = harness();

		const run = startDispatchOnce(request);
		const controller = request.abortRef.current!;
		balance.resolve(100n);
		created.resolve(PLAN);
		await run;

		expect(request.readWalletBalance).toHaveBeenCalledWith(SENDER, controller.signal);
		expect(request.createPlan).toHaveBeenCalledWith(PROCESS, SENDER, ROWS, { signal: controller.signal });
		expect(request.execute).toHaveBeenCalledWith(PLAN, controller);
	});

	it('never starts signing when the page unmounts during the pre-flight', async () => {
		const { request, balance, created, preparing } = harness();

		const run = startDispatchOnce(request);
		// The route's unmount cleanup aborts whatever abortRef holds.
		request.abortRef.current?.abort();
		balance.resolve(100n);
		created.resolve(PLAN);

		await expect(run).resolves.toBe('aborted');
		expect(request.execute).not.toHaveBeenCalled();
		expect(request.onPlan).not.toHaveBeenCalled();
		expect(request.onError).not.toHaveBeenCalled();
		expect(preparing).toEqual([true]);
	});

	it('stays silent when an aborted pre-flight read rejects', async () => {
		const { request, balance } = harness();

		const run = startDispatchOnce(request);
		request.abortRef.current?.abort();
		balance.reject(new DOMException('The operation was aborted.', 'AbortError'));

		await expect(run).resolves.toBe('aborted');
		expect(request.onError).not.toHaveBeenCalled();
		expect(request.createPlan).not.toHaveBeenCalled();
	});

	it('releases the gate after a failed pre-flight so the user can retry', async () => {
		const { request, balance, preparing } = harness();

		const run = startDispatchOnce(request);
		balance.resolve(1n);

		await expect(run).resolves.toBe('failed');
		expect(request.onError).toHaveBeenCalledWith(
			dispatchErrorMessage(new Error('asset-purchase-insufficient-funds'))
		);
		expect(request.createPlan).not.toHaveBeenCalled();
		expect(request.inFlight.current).toBe(false);
		expect(preparing).toEqual([true, false]);
	});

	it('reports unavailable balance state through the same gate without reading anything', async () => {
		const { request, preparing } = harness({ state: { ...STATE, holderBalancesAvailable: false } });

		await expect(startDispatchOnce(request)).resolves.toBe('failed');
		expect(request.readWalletBalance).not.toHaveBeenCalled();
		expect(request.inFlight.current).toBe(false);
		expect(preparing).toEqual([true, false]);
	});

	it('skips the AR balance read when there is no reward estimate', async () => {
		const { request, created } = harness({ requiredWinston: null });

		const run = startDispatchOnce(request);
		created.resolve(PLAN);

		await expect(run).resolves.toBe('executed');
		expect(request.readWalletBalance).not.toHaveBeenCalled();
		expect(request.execute).toHaveBeenCalledTimes(1);
	});

	it('refuses to start while a resume holds the gate', async () => {
		const { request } = harness({ inFlight: { current: true } });

		await expect(startDispatchOnce(request)).resolves.toBe('busy');
		expect(request.onPreparingChange).not.toHaveBeenCalled();
		expect(request.abortRef.current).toBeNull();
		expect(request.readWalletBalance).not.toHaveBeenCalled();
	});
});

describe('dispatch recovery errors', () => {
	it('explains why a missing signed transaction requires manual review instead of replacement', () => {
		const message = dispatchErrorMessage(new Error(DISPATCH_SIGNED_TRANSACTION_RECOVERY_REQUIRED));

		expect(message).toContain('may already have reached Arweave');
		expect(message).toContain('will not sign a replacement');
		expect(message).toContain('manual review');
	});

	it('explains that a state-read deadline cannot create another signature', () => {
		const message = dispatchErrorMessage(new Error(DISPLAY_STATE_TIMEOUT_ERROR));

		expect(message).toContain('within 45 seconds');
		expect(message).toContain('No new transfer was signed');
		expect(message).toContain('saved dispatch progress remains available');
	});
});

describe('dispatch run end activity', () => {
	const progressed: DispatchPlan = {
		...PLAN,
		rows: [
			{ ...PLAN.rows[0], status: 'settled' },
			{ ...PLAN.rows[1], status: 'posted', transactionId: 'T'.repeat(43) },
			{ address: 'C'.repeat(43), quantity: '3', status: 'unsent' },
		],
	};

	it('replaces the working row with a paused row when the page unmounts mid-run', () => {
		const activity = dispatchEndActivity({ kind: 'interrupted' }, progressed);

		expect(activity.phase).toBe('error');
		expect(activity.status).toContain('Dispatch paused when you left the page');
		expect(activity.status).toContain('1 of 3 settled');
		expect(activity.status).toContain('Resume it from Dispatch on this token');
		expect(activity.status).toContain('posted transfers will not be re-sent');
		// Clicking the row opens the token page, not the dispatch route.
		expect(activity.status).not.toContain('Open the dispatch page');
	});

	it('removes the row when the run completes', () => {
		expect(dispatchEndActivity({ kind: 'complete' }, progressed)).toEqual({ phase: 'done', status: '' });
	});

	it('keeps the failure message on the row when the run fails', () => {
		const cause = new Error('wallet-account-changed');

		expect(dispatchEndActivity({ kind: 'failed', cause }, progressed)).toEqual({
			phase: 'error',
			status: dispatchErrorMessage(cause),
		});
	});

	it('never leaves a stopped run in the working phase', () => {
		const ends = [
			{ kind: 'complete' },
			{ kind: 'failed', cause: new Error('x') },
			{ kind: 'interrupted' },
		] as const;

		for (const end of ends) expect(dispatchEndActivity(end, PLAN).phase).not.toBe('working');
	});

	it('reaches the interrupted branch: an unmount abort rejects runDispatch instead of resolving it', async () => {
		const store = new Map<string, string>();
		const storage = {
			getItem: (key: string) => store.get(key) ?? null,
			setItem: (key: string, value: string) => void store.set(key, value),
			removeItem: (key: string) => void store.delete(key),
		};
		const controller = new AbortController();
		const onProgress = vi.fn(() => controller.abort());
		const saved: DispatchPlan = { ...PLAN, baseline: { [ROWS[0].address]: '0', [ROWS[1].address]: '0' } };

		await expect(runDispatch(saved, { signal: controller.signal, storage, onProgress })).rejects.toMatchObject({
			name: 'AbortError',
		});
		expect(controller.signal.aborted).toBe(true);
		expect(onProgress).toHaveBeenCalledTimes(1);
	});
});
