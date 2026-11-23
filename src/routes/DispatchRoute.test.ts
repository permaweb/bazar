import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { TransactionDispatchRejectedError } from 'weave-wrangler';

import type { AssetState } from 'api/asset-marketplace';
import { DISPLAY_STATE_TIMEOUT_ERROR } from 'api/asset-state-store';
import {
	DISPATCH_SIGNED_TRANSACTION_RECOVERY_REQUIRED,
	type DispatchPlan,
	DispatchSignedTransactionRejectedError,
	runDispatch,
} from 'api/fungible-dispatch';

import { assetStateErrorMessage } from '../app/App';

import {
	dispatchEndActivity,
	DispatchRecipientCell,
	dispatchErrorMessage,
	dispatchFeeLabel,
	DispatchFeeNotice,
	dispatchFeeStatus,
	DispatchPlanStatus,
	dispatchPlanStatusText,
	dispatchRowStatusLabel,
	DispatchRunError,
	type DispatchStartRequest,
	dispatchStateReadMessage,
	focusCreatedPlan,
	notAppliedSignAgainConfirmation,
	rejectedSignatureConfirmation,
	rejectedSignatureOutcomeMessage,
	startDispatchOnce,
	transferRewardErrorMessage,
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

describe('dispatch token-state read errors', () => {
	it('describes a state-read timeout as a 45 second deadline, not a freshly minted token', () => {
		const message = dispatchStateReadMessage(new Error(DISPLAY_STATE_TIMEOUT_ERROR));

		expect(message).toContain('45 seconds');
		expect(message).not.toContain('20 minutes');
	});

	it('uses the asset page rate-limit copy for HTTP 429', () => {
		const message = dispatchStateReadMessage(new Error('HTTP 429'));

		expect(message).toBe(assetStateErrorMessage(new Error('HTTP 429')));
		expect(message).toContain('rate-limiting');
		expect(message).not.toContain('20 minutes');
	});

	it('does not blame token age for peer outages or unreachable peers', () => {
		for (const cause of ['HTTP 502', 'AO response quorum not met', 'Failed to fetch']) {
			expect(dispatchStateReadMessage(new Error(cause))).not.toContain('20 minutes');
		}
	});

	it('keeps the freshly minted hint for not-found and unrecognised causes', () => {
		const notFound = dispatchStateReadMessage(new Error('HTTP 404'));
		expect(notFound).toContain('(HTTP 404)');
		expect(notFound).toContain('20 minutes');

		expect(dispatchStateReadMessage(new Error('historical-state-slot-mismatch'))).toContain('20 minutes');
	});
});

describe('dispatch network fee', () => {
	it('maps a failed fee quote to fixed copy without the raw code', () => {
		const message = transferRewardErrorMessage(new Error('transfer-price-500'));

		expect(message).toBe('Network fee could not be checked. Retry.');
		expect(transferRewardErrorMessage(new Error('transfer-price-invalid'))).toBe(message);
		expect(transferRewardErrorMessage(new TypeError('Failed to fetch'))).toBe(message);
		expect(transferRewardErrorMessage(new Error('transfer-price-429'))).toContain('rate-limiting');
		expect(transferRewardErrorMessage(new Error('transfer-price-429'))).not.toContain('transfer-price');
	});

	it('makes the fee quote states explicit', () => {
		const base = { walletConnected: true, rowsParsed: true, reward: null, rewardError: null };

		expect(dispatchFeeStatus({ ...base, rowsParsed: false })).toBe('idle');
		expect(dispatchFeeStatus(base)).toBe('checking');
		// Without a wallet the fee does not gate sending, so it is not presented as pending.
		expect(dispatchFeeStatus({ ...base, walletConnected: false })).toBe('idle');
		expect(dispatchFeeStatus({ ...base, rewardError: 'Network fee could not be checked. Retry.' })).toBe('error');
		expect(dispatchFeeStatus({ ...base, reward: 1000n })).toBe('ready');
	});

	it('labels the total AR cost for every fee state', () => {
		expect(dispatchFeeLabel('checking', null)).toBe('Checking…');
		expect(dispatchFeeLabel('error', null)).toBe('Unavailable');
		expect(dispatchFeeLabel('idle', null)).toBe('—');
		expect(dispatchFeeLabel('ready', 1_000_000_000_000n)).toBe('1 AR');
	});

	it('renders a status notice with a Retry when the fee quote fails', () => {
		const markup = renderToStaticMarkup(
			React.createElement(DispatchFeeNotice, {
				message: transferRewardErrorMessage(new Error('transfer-price-500')),
				blocksDispatch: true,
				onRetry: () => undefined,
			})
		);

		expect(markup).toContain('role="status"');
		expect(markup).toContain('Network fee unavailable');
		expect(markup).toContain('Network fee could not be checked.');
		expect(markup).toContain('Sign and dispatch stays disabled until the fee is known.');
		expect(markup).toContain('Retry</button>');
		expect(markup).not.toContain('transfer-price');
	});

	it('does not claim the fee blocks sending when no wallet is connected', () => {
		const markup = renderToStaticMarkup(
			React.createElement(DispatchFeeNotice, {
				message: 'Network fee could not be checked. Retry.',
				blocksDispatch: false,
				onRetry: () => undefined,
			})
		);

		expect(markup).not.toContain('stays disabled');
	});
});

describe('dispatch announcements and focus', () => {
	it('announces a run failure as an alert with the mapped message', () => {
		const message = dispatchErrorMessage(new Error('asset-purchase-insufficient-funds'));
		const markup = renderToStaticMarkup(React.createElement(DispatchRunError, { message }));

		expect(markup).toContain('role="alert"');
		expect(markup).toContain('inline-error');
		expect(markup).toContain('Your AR balance cannot cover the transfer amounts plus network rewards.');
	});

	it('keeps the progress region mounted and empty until a run reports progress', () => {
		const idle = dispatchPlanStatusText({ hasPlan: false, complete: false, running: false, settled: 0, total: 0 });
		const markup = renderToStaticMarkup(React.createElement(DispatchPlanStatus, { text: idle }));

		expect(idle).toBe('');
		expect(markup).toContain('role="status"');
		expect(markup).toContain('aria-atomic="true"');
		expect(markup).toContain('sr-only');
	});

	it('moves the progress region through running, paused and complete', () => {
		const plan = { hasPlan: true, settled: 1, total: 3 };

		// A saved plan that is not running says nothing; the visible heading covers it.
		expect(dispatchPlanStatusText({ ...plan, complete: false, running: false })).toBe('');
		// While running only the plain counter is spoken, without posted/sender detail.
		expect(dispatchPlanStatusText({ ...plan, complete: false, running: true })).toBe('1 of 3 settled');
		expect(dispatchPlanStatusText({ ...plan, settled: 2, complete: false, running: true })).toBe('2 of 3 settled');
		const done = dispatchPlanStatusText({ ...plan, settled: 3, complete: true, running: true });
		expect(done).toBe('Dispatch complete. All transfers settled.');
		expect(dispatchPlanStatusText({ ...plan, settled: 3, complete: true, running: false })).toBe(done);

		const markup = renderToStaticMarkup(React.createElement(DispatchPlanStatus, { text: done }));
		expect(markup).toContain('role="status"');
		expect(markup).toContain('Dispatch complete');
	});

	it('focuses the plan heading only once, after start() created the plan', () => {
		const target = { focus: vi.fn() };
		const justCreated = { current: true };

		expect(focusCreatedPlan(justCreated, target)).toBe(true);
		expect(target.focus).toHaveBeenCalledTimes(1);
		expect(justCreated.current).toBe(false);

		// Later onProgress updates re-run the effect but must not pull focus again.
		expect(focusCreatedPlan(justCreated, target)).toBe(false);
		expect(target.focus).toHaveBeenCalledTimes(1);
	});

	it('never takes focus when a saved plan is restored on page open', () => {
		const target = { focus: vi.fn() };

		expect(focusCreatedPlan({ current: false }, target)).toBe(false);
		expect(target.focus).not.toHaveBeenCalled();
	});

	it('keeps the request until the heading has mounted', () => {
		const justCreated = { current: true };

		expect(focusCreatedPlan(justCreated, null)).toBe(false);
		expect(justCreated.current).toBe(true);
	});
});

describe('dispatch gateway rejection copy', () => {
	const html = '<html><body>Bad Request</body></html>';

	it('tells a fresh definitive rejection that Resume signs a replacement for that holder', () => {
		const message = dispatchErrorMessage(
			new TransactionDispatchRejectedError(400, `transaction-dispatch-400: ${html}`)
		);

		expect(message).toContain('Resume signs a replacement for this holder');
		expect(message).not.toContain('<');
	});

	it("tells a restored rejection to discard that row's rejected signature", () => {
		expect(dispatchErrorMessage(new DispatchSignedTransactionRejectedError(['A'.repeat(43)]))).toContain(
			"Discard this row's rejected signature to sign a replacement"
		);
		expect(
			dispatchErrorMessage(new DispatchSignedTransactionRejectedError(['A'.repeat(43), 'B'.repeat(43)]))
		).toContain('2 rows marked Rejected');
	});

	it('calls 5xx and throttling answers gateway unavailability, never a rejection, and never echoes the body', () => {
		for (const status of [503, 502, 408, 425, 429]) {
			const message = dispatchErrorMessage(new Error(`transaction-dispatch-${status}: ${html}`));
			expect(message).toContain(`temporarily unavailable (HTTP ${status})`);
			expect(message).toContain('Resume retries the same signed transfer');
			expect(message).not.toMatch(/rejected|</);
		}
	});

	it('keeps other gateway statuses on the same signed transfer without the raw body', () => {
		const message = dispatchErrorMessage(new Error(`transaction-dispatch-404: ${html}`));
		expect(message).toContain('HTTP 404');
		expect(message).toContain('Resume retries the same signed transfer');
		expect(message).not.toContain('<');
	});

	it('explains the per-row discard decision and both outcomes', () => {
		const confirmation = rejectedSignatureConfirmation('A'.repeat(43));
		expect(confirmation).toContain('reads fresh holder balances first');
		expect(confirmation).toContain('marked settled and nothing is re-signed');
		expect(rejectedSignatureOutcomeMessage('settled')).toContain('marked the row settled');
		expect(rejectedSignatureOutcomeMessage('discarded')).toContain(
			'Resume signs a replacement for this holder only'
		);
	});
});

describe('dispatch receipt settlement copy', () => {
	const a = 'A'.repeat(43);
	const b = 'B'.repeat(43);

	it('names a process-proven rejection Not applied and says no tokens moved', () => {
		const message = dispatchErrorMessage(new DispatchSignedTransactionRejectedError([a], [a]));
		expect(message).toContain('the row marked Not applied');
		expect(message).toContain('no tokens moved');
		expect(message).toContain('Sign again');
		expect(message).not.toContain('may have been posted');

		const mixed = dispatchErrorMessage(new DispatchSignedTransactionRejectedError([a, b], [b]));
		expect(mixed).toContain('the row marked Rejected');
		expect(mixed).toContain('the row marked Not applied');
		expect(notAppliedSignAgainConfirmation(a)).toContain('no tokens moved');
	});

	it('keeps unproven outcomes Posted and never calls them rejected', () => {
		for (const code of [
			'fungible-transfer-proof-mismatch',
			'asset-balance-proof-unavailable',
			'scheduled-action-state-missing',
		]) {
			const message = dispatchErrorMessage(new Error(code));
			expect(message).toContain('stays Posted');
			expect(message).not.toMatch(/rejected/i);
		}
	});

	it('labels rows by the evidence that settled them', () => {
		expect(dispatchRowStatusLabel({ startingSlot: 41 }, { status: 'settled' })).toBe('Settled');
		expect(dispatchRowStatusLabel({}, { status: 'settled' })).toBe('Settled (balance-checked)');
		expect(dispatchRowStatusLabel({ startingSlot: 41 }, { status: 'rejected', rejectedBy: 'process' })).toBe(
			'Not applied'
		);
		expect(dispatchRowStatusLabel({ startingSlot: 41 }, { status: 'rejected' })).toBe('Rejected');
		expect(dispatchRowStatusLabel({}, { status: 'posted' })).toBe('Posted');
	});
});

describe('dispatch recipient review', () => {
	const address = '1uTLV5GvfQ5M46Tq_DTeJL7rIy7vCAOMxQ7Fbf82YZw';

	it('shows the full recipient address as text, not only in a hover tooltip', () => {
		const markup = renderToStaticMarkup(React.createElement(DispatchRecipientCell, { address }));

		expect(markup).toContain(`<span>${address}</span>`);
		expect(markup).not.toContain(`${address.slice(0, 6)}…${address.slice(-6)}`);
	});

	it('gives keyboard and screen-reader users a focusable control named with the full address', () => {
		const markup = renderToStaticMarkup(React.createElement(DispatchRecipientCell, { address }));
		const button = markup.match(/<button[^>]*>/)?.[0] ?? '';

		expect(button).toContain(`aria-label="Copy recipient address ${address}"`);
		expect(button).not.toContain('tabindex="-1"');
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
