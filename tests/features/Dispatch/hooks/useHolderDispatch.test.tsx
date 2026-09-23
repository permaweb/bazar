// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DispatchPlan } from 'api/dispatch';
import type { AssetState } from 'api/marketplace';

import { useHolderDispatch } from 'features/Dispatch/hooks/useHolderDispatch';
import { holderDispatchQuote } from 'features/Dispatch/model/dispatch';
import { appError } from 'helpers/app-error';

import { flushPromises, renderHook } from '../../../test-utils/hook-renderer';

const mocks = vi.hoisted(() => ({
	wallet: { address: null as string | null, openConnectDialog: vi.fn() },
	loadDispatchPlan: vi.fn(),
	discardDispatchPlan: vi.fn(),
	createDispatchPlan: vi.fn(),
	runDispatch: vi.fn(),
	walletBalance: vi.fn(),
	announce: vi.fn(),
}));

vi.mock('providers/WalletProvider', () => ({ useWallet: () => mocks.wallet }));
vi.mock('api/dispatch', async (importOriginal) => ({
	...(await importOriginal<typeof import('api/dispatch')>()),
	loadDispatchPlan: mocks.loadDispatchPlan,
	discardDispatchPlan: mocks.discardDispatchPlan,
	createDispatchPlan: mocks.createDispatchPlan,
	runDispatch: mocks.runDispatch,
}));
vi.mock('api/transactions', () => ({
	AssetTransactionClient: class {
		walletBalance = mocks.walletBalance;
	},
}));
vi.mock('api/operations', () => ({ announceFungibleOperationActivityChange: mocks.announce }));

const PROCESS = 'P'.repeat(43);
const SENDER = 'S'.repeat(43);
const ALICE = 'A'.repeat(43);
const token = { ticker: 'SIG', denomination: 0, holderBalancesAvailable: true } as unknown as AssetState;

function plan(status: 'unsent' | 'posted' | 'settled' = 'unsent', sender = SENDER): DispatchPlan {
	return {
		processId: PROCESS,
		sender,
		createdAt: 1,
		baseline: { [ALICE]: '0' },
		rows: [{ address: ALICE, quantity: '1', status }],
	};
}

const quote = holderDispatchQuote(`${ALICE},1`, { denomination: 0 }, 10n);

function render(currentToken: AssetState | null = token) {
	return renderHook((props: { token: AssetState | null }) => useHolderDispatch(PROCESS, props.token), {
		token: currentToken,
	});
}

beforeEach(() => {
	mocks.wallet.address = SENDER;
	mocks.wallet.openConnectDialog.mockReset();
	mocks.loadDispatchPlan.mockReset().mockReturnValue(null);
	mocks.discardDispatchPlan.mockReset();
	mocks.createDispatchPlan.mockReset();
	mocks.runDispatch.mockReset();
	mocks.walletBalance.mockReset().mockResolvedValue(1_000n);
	mocks.announce.mockReset();
});

afterEach(() => {
	document.body.innerHTML = '';
});

describe('useHolderDispatch', () => {
	it('restores the saved plan for the token', () => {
		mocks.loadDispatchPlan.mockReturnValue(plan('posted'));
		const hook = render();
		expect(mocks.loadDispatchPlan).toHaveBeenCalledWith(PROCESS);
		expect(hook.current().plan).toEqual(plan('posted'));
		expect(hook.current().progress).toMatchObject({ posted: 1, complete: false, senderMismatch: false });
		hook.unmount();
	});

	it('asks for a wallet instead of signing when none is connected', async () => {
		mocks.wallet.address = null;
		const hook = render();
		await React.act(() => hook.current().start(quote, false));
		expect(mocks.wallet.openConnectDialog).toHaveBeenCalled();
		expect(mocks.createDispatchPlan).not.toHaveBeenCalled();
		hook.unmount();
	});

	it('does not start an unapproved expensive dispatch', async () => {
		const expensive = holderDispatchQuote(`${ALICE},1`, { denomination: 0 }, 100_000_000_001n);
		const hook = render();
		await React.act(() => hook.current().start(expensive, false));
		expect(mocks.walletBalance).not.toHaveBeenCalled();
		hook.unmount();
	});

	it('stops before creating a plan when the AR balance cannot pay the rewards', async () => {
		mocks.walletBalance.mockResolvedValue(5n);
		const hook = render();
		await React.act(() => hook.current().start(quote, false));
		expect(mocks.createDispatchPlan).not.toHaveBeenCalled();
		expect(hook.current().run).toEqual({
			status: 'failed',
			error: 'Your AR balance cannot cover the transfer amounts plus network rewards.',
		});
		hook.unmount();
	});

	it('refuses to sign without complete holder balances', async () => {
		const hook = render({ ...token, holderBalancesAvailable: false } as AssetState);
		await React.act(() => hook.current().start(quote, false));
		expect(mocks.walletBalance).not.toHaveBeenCalled();
		expect(hook.current().run.status).toBe('failed');
		hook.unmount();
	});

	it('creates a plan, runs it with progress, and announces the activity', async () => {
		const created = plan('unsent');
		mocks.createDispatchPlan.mockResolvedValue(created);
		let finish: () => void = () => undefined;
		mocks.runDispatch.mockImplementation(
			(_plan, options) =>
				new Promise<DispatchPlan>((resolve) => {
					options.onProgress(plan('posted'));
					finish = () => resolve(plan('settled'));
				})
		);
		const hook = render();
		let started: Promise<void> = Promise.resolve();
		React.act(() => {
			started = hook.current().start(quote, false);
		});
		await flushPromises();

		expect(mocks.createDispatchPlan).toHaveBeenCalledWith(PROCESS, SENDER, [{ address: ALICE, quantity: '1' }]);
		expect(hook.current().run).toEqual({ status: 'running' });
		expect(hook.current().plan).toEqual(plan('posted'));
		expect(mocks.announce).toHaveBeenCalledWith(
			expect.objectContaining({
				type: 'upsert',
				activity: expect.objectContaining({ status: 'Dispatching to 1 holder…', phase: 'working' }),
			})
		);
		expect(mocks.announce).toHaveBeenCalledWith(
			expect.objectContaining({ activity: expect.objectContaining({ status: '0 of 1 settled' }) })
		);

		finish();
		await React.act(() => started);
		expect(hook.current().run).toEqual({ status: 'idle' });
		expect(mocks.announce).toHaveBeenLastCalledWith({
			type: 'remove',
			id: `fungible:${PROCESS}:${SENDER}:dispatch`,
			owner: SENDER,
		});
		hook.unmount();
	});

	it('reports a failed run and keeps the plan resumable', async () => {
		mocks.loadDispatchPlan.mockReturnValue(plan('posted'));
		mocks.runDispatch.mockRejectedValueOnce(appError('asset-state-timeout'));
		const hook = render();
		await React.act(() => hook.current().resume());
		expect(hook.current().run).toMatchObject({ status: 'failed' });
		expect(hook.current().plan).toEqual(plan('posted'));
		expect(mocks.announce).toHaveBeenLastCalledWith(
			expect.objectContaining({ activity: expect.objectContaining({ phase: 'error' }) })
		);

		React.act(() => hook.current().clearError());
		expect(hook.current().run).toEqual({ status: 'idle' });
		hook.unmount();
	});

	it('only resumes from the wallet that started the plan', async () => {
		mocks.loadDispatchPlan.mockReturnValue(plan('posted', ALICE));
		const hook = render();
		expect(hook.current().progress.senderMismatch).toBe(true);
		await React.act(() => hook.current().resume());
		expect(mocks.runDispatch).not.toHaveBeenCalled();
		hook.unmount();
	});

	it('aborts a running dispatch on unmount without reporting a failure', async () => {
		mocks.loadDispatchPlan.mockReturnValue(plan('posted'));
		let signal: AbortSignal | undefined;
		mocks.runDispatch.mockImplementation((_plan, options) => {
			signal = options.signal;
			return new Promise((_resolve, reject) =>
				options.signal.addEventListener('abort', () => reject(new Error('aborted')))
			);
		});
		const hook = render();
		React.act(() => {
			void hook.current().resume();
		});
		hook.unmount();
		await flushPromises();
		expect(signal?.aborted).toBe(true);
		expect(mocks.announce).not.toHaveBeenCalledWith(
			expect.objectContaining({ activity: expect.objectContaining({ phase: 'error' }) })
		);
	});

	it('discards the saved plan and its activity unless a run is active', async () => {
		mocks.loadDispatchPlan.mockReturnValue(plan('posted'));
		const hook = render();
		React.act(() => hook.current().discard());
		expect(mocks.discardDispatchPlan).toHaveBeenCalledWith(PROCESS);
		expect(mocks.announce).toHaveBeenCalledWith({
			type: 'remove',
			id: `fungible:${PROCESS}:${SENDER}:dispatch`,
			owner: SENDER,
		});
		expect(hook.current().plan).toBeNull();
		hook.unmount();
	});
});
