// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Operation } from 'api/operations';

import { useAtomicOperationFlow } from 'features/Operations/hooks/useAtomicOperationFlow';
import { appError } from 'helpers/app-error';

import { renderHook } from '../../../test-utils/render-hook';

const mocks = vi.hoisted(() => ({
	readAssetState: vi.fn(),
	discoverPendingAssetOffers: vi.fn(),
	acquireClaim: vi.fn(),
	releaseClaim: vi.fn(),
	makeOffer: vi.fn(),
	transfer: vi.fn(),
	restore: vi.fn(),
	dispatchAndConfirm: vi.fn(),
	waitForOfferAcceptance: vi.fn(),
	waitForFungibleTransfer: vi.fn(),
	purchaseRun: vi.fn(),
	purchaseSnapshot: vi.fn(),
	purchaseState: vi.fn(),
	abandon: vi.fn(),
	release: vi.fn(),
}));

vi.mock('api/marketplace', async (importOriginal) => ({
	...(await importOriginal<typeof import('api/marketplace')>()),
	readAssetStateWithDeadline: (...args: unknown[]) => mocks.readAssetState(...args),
}));
vi.mock('api/discovery', async (importOriginal) => ({
	...(await importOriginal<typeof import('api/discovery')>()),
	discoverPendingAssetOffers: (...args: unknown[]) => mocks.discoverPendingAssetOffers(...args),
}));
vi.mock('api/operations', async (importOriginal) => ({
	...(await importOriginal<typeof import('api/operations')>()),
	acquireWalletOperationClaim: (storage: Storage, key: string, keys: string[], options: unknown) =>
		mocks.acquireClaim(storage, key, keys, options),
	releaseWalletOperationClaim: (storage: Storage, claim: unknown) => mocks.releaseClaim(storage, claim),
}));
vi.mock('api/transactions', async (importOriginal) => ({
	...(await importOriginal<typeof import('api/transactions')>()),
	loadAtomicTransactionRuntime: async () => ({
		AssetTransactionClient: class {
			makeOffer(...args: unknown[]) {
				return mocks.makeOffer(...args);
			}
			transfer(...args: unknown[]) {
				return mocks.transfer(...args);
			}
			restore(...args: unknown[]) {
				return mocks.restore(...args);
			}
			purchaseAdapter() {
				return {
					restorePrepared: async () => undefined,
					preparePayment: async () => undefined,
				};
			}
			waitForOfferAcceptance(...args: unknown[]) {
				return mocks.waitForOfferAcceptance(...args);
			}
			waitForFungibleTransfer(...args: unknown[]) {
				return mocks.waitForFungibleTransfer(...args);
			}
		},
		SwapPurchase: class {
			listeners: Array<(state: unknown) => void> = [];
			on(_event: string, listener: (state: unknown) => void) {
				this.listeners.push(listener);
				return () => undefined;
			}
			state() {
				return mocks.purchaseState();
			}
			snapshot() {
				return mocks.purchaseSnapshot();
			}
			async run() {
				const final = await mocks.purchaseRun();
				for (const listener of this.listeners) listener(final);
				return final;
			}
			abandon() {
				mocks.abandon();
			}
			skip() {
				return undefined;
			}
		},
		acquireAssetObserverNetwork: () => ({
			ready: Promise.resolve(),
			network: { name: 'network' },
			release: () => mocks.release(),
		}),
		dispatchAndConfirm: (...args: unknown[]) => mocks.dispatchAndConfirm(...args),
	}),
	continuePaymentConfirmations: () => ({ stop: () => undefined }),
}));

const OWNER = 'O'.repeat(43);
const RECIPIENT = 'R'.repeat(43);
const ASSET = { id: 'A'.repeat(43), name: 'Atomic art' };
const TRANSACTION = 'T'.repeat(43);
const REGISTRATION = 'G'.repeat(43);
const PAYMENT = 'P'.repeat(43);
const ORDER = {
	orderId: 'D'.repeat(43),
	creator: 'S'.repeat(43),
	recipient: 'S'.repeat(43),
	asking: '100',
	quantity: '1',
	status: 'open',
} as any;

const operationKey = `bazar-operation:${ASSET.id}:${OWNER}`;
const purchaseKey = `bazar-purchase:${ASSET.id}:${OWNER}`;
const claimKey = `bazar-operation-claim:${ASSET.id}:${OWNER}`;

type FlowProps = { operation: Operation; value: string; visible?: boolean };

const onOperation = vi.fn();
const onUpdate = vi.fn();
const onClose = vi.fn();

function flowHook(props: FlowProps) {
	return renderHook(
		(current: FlowProps) =>
			useAtomicOperationFlow({
				taskId: 'task-1',
				asset: ASSET,
				collectionId: 'collection-1',
				owner: OWNER,
				operation: current.operation,
				visible: current.visible ?? true,
				value: current.value,
				onUpdate,
				onOperation,
				onClose,
			}),
		props
	);
}

function ownedState() {
	return { state: { balances: { [OWNER]: '1' }, orders: {}, raw: { 'at-slot': '42' } } };
}

beforeEach(() => {
	localStorage.clear();
	vi.clearAllMocks();
	mocks.acquireClaim.mockImplementation(async (storage: Storage, key: string) => {
		storage.setItem(key, JSON.stringify({ attemptId: 'attempt-1', createdAt: 1 }));
		return { key, attemptId: 'attempt-1', releaseLock: () => undefined };
	});
	mocks.readAssetState.mockResolvedValue(ownedState());
	mocks.discoverPendingAssetOffers.mockResolvedValue([]);
	mocks.makeOffer.mockResolvedValue({ id: TRANSACTION });
	mocks.transfer.mockResolvedValue({ id: TRANSACTION });
	mocks.restore.mockReturnValue({ id: TRANSACTION });
	mocks.dispatchAndConfirm.mockResolvedValue(undefined);
	mocks.waitForOfferAcceptance.mockResolvedValue(undefined);
	mocks.waitForFungibleTransfer.mockResolvedValue(undefined);
});

describe('atomic operation flow', () => {
	it('signs nothing until the user submits', async () => {
		const hook = flowHook({ operation: { kind: 'sell' }, value: '1.5' });
		await hook.flush(3);

		expect(mocks.acquireClaim).not.toHaveBeenCalled();
		expect(mocks.makeOffer).not.toHaveBeenCalled();
		expect(hook.current().view.phase).toBe('form');
		hook.unmount();
	});

	it('runs a listing through live-state checks, recovery, and confirmations', async () => {
		const hook = flowHook({ operation: { kind: 'sell' }, value: '1.5' });
		hook.act(() => hook.current().submit());
		await hook.flush();

		expect(mocks.readAssetState).toHaveBeenCalledWith(ASSET.id, expect.objectContaining({ maxAge: 0 }));
		expect(mocks.makeOffer).toHaveBeenCalledWith(
			{ processId: ASSET.id, quantity: '1', asking: '1500000000000', seller: OWNER },
			expect.any(AbortSignal)
		);
		expect(mocks.dispatchAndConfirm).toHaveBeenCalledWith(
			{ id: TRANSACTION },
			expect.objectContaining({ target: 5 })
		);
		expect(onOperation).toHaveBeenCalledWith({ kind: 'sell', resumeId: TRANSACTION, value: '1.5' });
		expect(hook.current().view.phase).toBe('done');
		expect(localStorage.getItem(operationKey)).toBeNull();
		expect(mocks.releaseClaim).toHaveBeenCalledTimes(1);
		hook.unmount();
	});

	it('saves the signed listing for recovery before it is submitted', async () => {
		let saved: string | null = null;
		mocks.dispatchAndConfirm.mockImplementation(async () => {
			saved = localStorage.getItem(operationKey);
		});
		const hook = flowHook({ operation: { kind: 'sell' }, value: '2' });
		hook.act(() => hook.current().submit());
		await hook.flush();

		expect(JSON.parse(saved ?? 'null')).toMatchObject({
			txId: TRANSACTION,
			kind: 'sell',
			assetId: ASSET.id,
			activityKind: 'atomic',
			collectionId: 'collection-1',
			signer: OWNER,
			value: '2',
		});
		hook.unmount();
	});

	it('refuses a listing while live state shows a pending one', async () => {
		mocks.discoverPendingAssetOffers.mockResolvedValue([{ id: TRANSACTION, actor: OWNER }]);
		const hook = flowHook({ operation: { kind: 'sell' }, value: '2' });
		hook.act(() => hook.current().submit());
		await hook.flush();

		expect(mocks.makeOffer).not.toHaveBeenCalled();
		expect(hook.current().view.phase).toBe('error');
		expect(hook.current().view.message).toContain('You already submitted listing transaction');
		hook.unmount();
	});

	it('reports invalid details without signing or leaving the form', async () => {
		const hook = flowHook({ operation: { kind: 'transfer' }, value: 'not-an-address' });
		hook.act(() => hook.current().submit());
		await hook.flush(2);

		expect(mocks.acquireClaim).not.toHaveBeenCalled();
		expect(hook.current().view.phase).toBe('form');
		expect(hook.current().view.message).toContain('43-character Arweave address');
		hook.unmount();
	});

	it('stops when another attempt already holds the wallet operation claim', async () => {
		mocks.acquireClaim.mockRejectedValue(appError('wallet-recovery-conflict'));
		const hook = flowHook({ operation: { kind: 'sell' }, value: '2' });
		hook.act(() => hook.current().submit());
		await hook.flush();

		expect(mocks.makeOffer).not.toHaveBeenCalled();
		expect(hook.current().view.phase).toBe('error');
		expect(hook.current().failureKind).toBe('other');
		hook.unmount();
	});

	it('forgets a refused transfer so a replacement can be signed', async () => {
		localStorage.setItem(`bazar-signed-transaction:${TRANSACTION}`, '{}');
		mocks.dispatchAndConfirm.mockRejectedValue(appError('fungible-transfer-rejected'));
		const hook = flowHook({ operation: { kind: 'transfer' }, value: RECIPIENT });
		hook.act(() => hook.current().submit());
		await hook.flush();

		expect(hook.current().view.phase).toBe('error');
		expect(hook.current().transactionId).toBeNull();
		expect(localStorage.getItem(operationKey)).toBeNull();
		expect(localStorage.getItem(`bazar-signed-transaction:${TRANSACTION}`)).toBeNull();
		hook.unmount();
	});

	it('keeps a transfer transaction whose dispatch failed for another reason', async () => {
		mocks.transfer.mockResolvedValue({ id: TRANSACTION });
		mocks.dispatchAndConfirm.mockRejectedValue(appError('timeout'));
		const hook = flowHook({ operation: { kind: 'transfer' }, value: RECIPIENT });
		hook.act(() => hook.current().submit());
		await hook.flush();

		expect(hook.current().transactionId).toBe(TRANSACTION);
		expect(JSON.parse(localStorage.getItem(operationKey) ?? 'null')).toMatchObject({
			txId: TRANSACTION,
			startingSlot: 42,
		});
		hook.unmount();
	});

	it('refuses to sign a transfer whose live starting slot is unreadable', async () => {
		mocks.readAssetState.mockResolvedValue({ state: { balances: { [OWNER]: '1' }, orders: {}, raw: {} } });
		const hook = flowHook({ operation: { kind: 'transfer' }, value: RECIPIENT });
		hook.act(() => hook.current().submit());
		await hook.flush();

		expect(mocks.transfer).not.toHaveBeenCalled();
		expect(hook.current().view.phase).toBe('error');
		hook.unmount();
	});

	it('resumes saved signed work once, without asking for a new signature', async () => {
		const hook = flowHook({ operation: { kind: 'sell', resumeId: TRANSACTION, value: '2' }, value: '2' });
		await hook.flush();
		hook.rerender({ operation: { kind: 'sell', resumeId: TRANSACTION, value: '2' }, value: '2' });
		await hook.flush(2);

		expect(mocks.restore).toHaveBeenCalledTimes(1);
		expect(mocks.restore).toHaveBeenCalledWith(TRANSACTION, OWNER);
		expect(mocks.makeOffer).not.toHaveBeenCalled();
		expect(mocks.readAssetState).not.toHaveBeenCalled();
		expect(hook.current().view.phase).toBe('done');
		hook.unmount();
	});

	it('resumes a saved purchase with its snapshot and clears recovery when it completes', async () => {
		const snapshot = {
			registration: { id: REGISTRATION, dispatched: true },
			payment: { id: PAYMENT, dispatched: true },
		};
		localStorage.setItem(
			purchaseKey,
			JSON.stringify({ buyer: OWNER, order: ORDER, snapshot, activityKind: 'atomic' })
		);
		localStorage.setItem(
			`bazar-signed-transaction:${PAYMENT}`,
			JSON.stringify({ expectedSigner: OWNER, transaction: { id: PAYMENT } })
		);
		const complete = {
			stage: 'complete',
			success: true,
			registration: { id: REGISTRATION, dispatched: true },
			payment: { id: PAYMENT, dispatched: true },
		};
		mocks.purchaseState.mockReturnValue(complete);
		mocks.purchaseSnapshot.mockReturnValue(snapshot);
		mocks.purchaseRun.mockResolvedValue(complete);

		const hook = flowHook({ operation: { kind: 'buy', order: ORDER, resume: snapshot }, value: '' });
		await hook.flush();

		expect(mocks.readAssetState).not.toHaveBeenCalled();
		expect(mocks.acquireClaim).toHaveBeenCalledWith(
			localStorage,
			claimKey,
			[operationKey, purchaseKey],
			expect.objectContaining({ recovery: expect.objectContaining({ key: purchaseKey }) })
		);
		expect(hook.current().view.phase).toBe('done');
		expect(localStorage.getItem(purchaseKey)).toBeNull();
		expect(localStorage.getItem(`bazar-signed-transaction:${PAYMENT}`)).toBeNull();
		hook.unmount();
	});

	it('keeps a saved purchase when the dialog is closed to resume later', async () => {
		const snapshot = { registration: { id: REGISTRATION, dispatched: true } };
		const failed = { stage: 'failed', success: false, registration: snapshot.registration };
		mocks.purchaseState.mockReturnValue(failed);
		mocks.purchaseSnapshot.mockReturnValue(snapshot);
		mocks.purchaseRun.mockResolvedValue({ ...failed, error: { code: 'unexpected', message: 'timeout' } });

		const hook = flowHook({ operation: { kind: 'buy', order: ORDER, resume: snapshot }, value: '' });
		hook.act(() => hook.current().submit());
		await hook.flush();
		expect(hook.current().view.phase).toBe('error');

		localStorage.removeItem(purchaseKey);
		hook.act(() => hook.current().restartPurchase());
		expect(JSON.parse(localStorage.getItem(purchaseKey) ?? 'null')).toMatchObject({ buyer: OWNER, snapshot });
		expect(onClose).toHaveBeenCalledWith(false);
		expect(mocks.abandon).toHaveBeenCalled();
		expect(mocks.release).toHaveBeenCalled();
		hook.unmount();
	});

	it('forgets an unusable purchase before a fresh one is signed', async () => {
		const snapshot = { registration: { id: REGISTRATION, dispatched: true } };
		localStorage.setItem(purchaseKey, JSON.stringify({ buyer: OWNER, order: ORDER, snapshot }));
		localStorage.setItem(
			`bazar-signed-transaction:${REGISTRATION}`,
			JSON.stringify({ expectedSigner: OWNER, transaction: { id: REGISTRATION } })
		);
		const hook = flowHook({ operation: { kind: 'buy', order: ORDER, resume: snapshot }, value: '' });
		await hook.flush(2);

		hook.act(() => hook.current().startFreshPurchase());
		expect(localStorage.getItem(purchaseKey)).toBeNull();
		expect(localStorage.getItem(`bazar-signed-transaction:${REGISTRATION}`)).toBeNull();
		expect(onOperation).toHaveBeenCalledWith({ kind: 'buy', order: ORDER });
		expect(hook.current().view.phase).toBe('form');
		hook.unmount();
	});

	it('discards a rejected signature only on request', async () => {
		mocks.dispatchAndConfirm.mockRejectedValue(appError('transaction-dispatch-rejected'));
		localStorage.setItem(`bazar-signed-transaction:${TRANSACTION}`, '{}');
		const hook = flowHook({ operation: { kind: 'transfer' }, value: RECIPIENT });
		hook.act(() => hook.current().submit());
		await hook.flush();
		expect(hook.current().failureKind).toBe('transaction-rejected');
		expect(localStorage.getItem(operationKey)).not.toBeNull();

		hook.act(() => hook.current().discardRejectedSignature());
		expect(localStorage.getItem(operationKey)).toBeNull();
		expect(localStorage.getItem(`bazar-signed-transaction:${TRANSACTION}`)).toBeNull();
		expect(onClose).toHaveBeenCalledWith(false);
		hook.unmount();
	});

	it('reports every stage to the operation activity provider', async () => {
		const hook = flowHook({ operation: { kind: 'sell' }, value: '1.5' });
		hook.act(() => hook.current().submit());
		await hook.flush();

		const phases = onUpdate.mock.calls.map(([, patch]) => patch.phase);
		expect(phases[0]).toBe('form');
		expect(phases).toContain('working');
		expect(phases[phases.length - 1]).toBe('done');
		expect(onUpdate.mock.calls[phases.length - 1][0]).toBe('task-1');
		expect(onUpdate.mock.calls[phases.length - 1][2]).toBe(ASSET.id);
		hook.unmount();
	});

	it('cancels and releases everything the attempt held when the dialog unmounts', async () => {
		let attemptSignal: AbortSignal | undefined;
		mocks.dispatchAndConfirm.mockImplementation(
			(_transaction: unknown, options: { signal: AbortSignal }) =>
				new Promise(() => {
					attemptSignal = options.signal;
				})
		);
		const hook = flowHook({ operation: { kind: 'sell' }, value: '2' });
		hook.act(() => hook.current().submit());
		await hook.flush();
		expect(hook.current().view.phase).toBe('working');

		hook.unmount();
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(attemptSignal?.aborted).toBe(true);
	});
});

afterEach(() => {
	localStorage.clear();
});
