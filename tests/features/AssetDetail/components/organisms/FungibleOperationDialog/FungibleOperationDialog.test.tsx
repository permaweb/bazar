// @vitest-environment jsdom
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AssetSummary } from 'api/collections';
import type { AssetState, SwapOrder } from 'api/marketplace';

import FungibleOperationDialog from 'features/AssetDetail/components/organisms/FungibleOperationDialog/FungibleOperationDialog';
import type { FungibleOperation } from 'features/AssetDetail/model/fungible-operation';
import { appError } from 'helpers/app-error';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
	calls: [] as string[],
	restoreFails: false,
	settlementFails: false,
	waitFailure: null as 'rejected' | 'unknown' | null,
	freshState: null as unknown,
	released: { claim: 0, network: 0 },
}));

function preparedTransaction(id: string) {
	return { id, dispatch: async () => undefined };
}

vi.mock('api/transactions', async (importOriginal) => {
	const actual = await importOriginal<typeof import('api/transactions')>();
	class MockClient {
		async estimatePurchaseBatchCosts(orders: SwapOrder[]) {
			return orders.map((order) => ({ total: (BigInt(order.asking) + 7n).toString() }));
		}
		async walletBalance() {
			return 10n ** 15n;
		}
		restore(id: string) {
			mocks.calls.push('restore');
			if (mocks.restoreFails) throw new Error('signature missing');
			return preparedTransaction(id);
		}
		async makeOffer() {
			mocks.calls.push('makeOffer');
			return preparedTransaction('M'.repeat(43));
		}
		async cancelOrder() {
			mocks.calls.push('cancelOrder');
			return preparedTransaction('C'.repeat(43));
		}
		async transferFungible() {
			mocks.calls.push('transferFungible');
			return preparedTransaction('X'.repeat(43));
		}
		async waitForOfferAcceptance() {
			mocks.calls.push('waitForOfferAcceptance');
			if (mocks.waitFailure) throw appError('asset-state-timeout');
		}
		async waitForExactCancellation() {
			mocks.calls.push('waitForExactCancellation');
		}
		async waitForFungibleTransfer() {
			mocks.calls.push('waitForFungibleTransfer');
			if (mocks.waitFailure === 'rejected') throw appError('fungible-transfer-rejected');
			if (mocks.waitFailure === 'unknown') throw appError('unknown');
		}
		async preparePurchaseBatch(
			requests: Array<{ order: SwapOrder; fillQuantity: string }>,
			_signal: AbortSignal,
			onEvent: (event: unknown) => void
		) {
			mocks.calls.push('preparePurchaseBatch');
			onEvent({ type: 'quoted', entries: requests.map((request) => ({ ...request, paymentCost: '100' })) });
			return requests.map((request, index) => {
				const registrationId = `R${index}`.padEnd(43, 'r');
				const paymentId = `P${index}`.padEnd(43, 'p');
				onEvent({
					type: 'signed',
					kind: 'registration',
					orderId: request.order.orderId,
					transactionId: registrationId,
					cost: '1',
				});
				onEvent({
					type: 'signed',
					kind: 'payment',
					orderId: request.order.orderId,
					transactionId: paymentId,
					cost: '100',
				});
				return {
					order: request.order,
					fillQuantity: request.fillQuantity,
					registration: preparedTransaction(registrationId),
					payment: preparedTransaction(paymentId),
					paymentCost: '100',
					snapshot: {
						registration: { id: registrationId, dispatched: false },
						payment: { id: paymentId, dispatched: false },
					},
				};
			});
		}
		purchaseAdapter() {
			return { waitForRegistrationAcceptance: async () => undefined };
		}
	}
	class MockSwapPurchase {
		handlers = new Map<string, Array<(state: unknown) => void>>();
		current: Record<string, unknown> = { stage: 'idle', canSkip: false, success: false, updatedAt: 0 };
		constructor(
			public network: unknown,
			public adapter: {
				prepareBoth?: () => Promise<{ registration: { id: string }; payment: { id: string } }>;
				waitForRegistrationAcceptance?: (context: unknown) => Promise<void>;
			}
		) {}
		on(event: string, handler: (state: unknown) => void) {
			this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler]);
		}
		emit(event: string, state: Record<string, unknown>) {
			this.current = state;
			for (const handler of this.handlers.get(event) ?? []) handler(state);
		}
		state() {
			return this.current;
		}
		snapshot() {
			const registration = this.current.registration as { id: string } | undefined;
			const payment = this.current.payment as { id: string } | undefined;
			return {
				...(registration ? { registration: { id: registration.id, dispatched: true } } : {}),
				...(payment ? { payment: { id: payment.id, dispatched: true } } : {}),
			};
		}
		transaction(id: string, confirmations: number) {
			return {
				id,
				dispatched: true,
				views: [],
				consensus: { state: 'confirmed', confirmations, propagated: true },
			};
		}
		async run() {
			const prepared = await this.adapter.prepareBoth?.();
			const registrationId = prepared?.registration.id ?? 'R'.repeat(43);
			const paymentId = prepared?.payment.id ?? 'P'.repeat(43);
			const base = { canSkip: false, canDismiss: false, success: false, updatedAt: 1, backgroundable: true };
			this.emit('state', {
				...base,
				stage: 'registration-confirming',
				registration: this.transaction(registrationId, 2),
			});
			if (mocks.settlementFails && registrationId.startsWith('R1')) {
				const failed = {
					...base,
					stage: 'failed',
					registration: this.transaction(registrationId, 2),
					error: { code: 'unexpected', message: 'purchase-reservation-incomplete' },
				};
				this.emit('failed', failed);
				return failed;
			}
			try {
				await this.adapter.waitForRegistrationAcceptance?.({});
			} catch (cause) {
				const failed = {
					...base,
					stage: 'failed',
					registration: this.transaction(registrationId, 5),
					error: {
						code: 'unexpected',
						message: (cause as { reason?: string }).reason ?? 'purchase-reservation-incomplete',
					},
				};
				this.emit('failed', failed);
				return failed;
			}
			const complete = {
				...base,
				stage: 'complete',
				success: true,
				canDismiss: true,
				registration: this.transaction(registrationId, 5),
				payment: this.transaction(paymentId, 1),
			};
			this.emit('complete', complete);
			return complete;
		}
		skip() {
			return true;
		}
		abandon() {
			mocks.calls.push('abandon');
		}
	}
	return {
		...actual,
		AssetTransactionClient: MockClient,
		SwapPurchase: MockSwapPurchase,
		dispatchAndConfirm: async (
			_prepared: { id: string },
			options: {
				onViews(views: unknown[]): void;
				onConsensus(consensus: unknown): void;
				onProgress(progress: { confirmations: number }): void;
			}
		) => {
			mocks.calls.push('dispatchAndConfirm');
			options.onViews([]);
			options.onProgress({ confirmations: 2 });
			options.onConsensus({ state: 'confirmed', confirmations: 2 });
		},
		continuePaymentConfirmations: () => ({ stop: () => undefined }),
	};
});

vi.mock('api/observers', () => ({
	acquireAssetObserverNetwork: () => ({
		ready: Promise.resolve(),
		network: {},
		release: () => {
			mocks.released.network += 1;
		},
	}),
}));

vi.mock('api/marketplace', async (importOriginal) => {
	const actual = await importOriginal<typeof import('api/marketplace')>();
	return { ...actual, readAssetStateWithDeadline: async () => ({ state: mocks.freshState }) };
});

vi.mock('api/operations', async (importOriginal) => {
	const actual = await importOriginal<typeof import('api/operations')>();
	return {
		...actual,
		acquireWalletOperationClaim: async (storage: Storage, claimKey: string) => {
			storage.setItem(claimKey, JSON.stringify({ attemptId: 'attempt-1', createdAt: 1 }));
			return {
				key: claimKey,
				attemptId: 'attempt-1',
				releaseLock: () => {
					mocks.released.claim += 1;
				},
			};
		},
	};
});

vi.mock('features/TransactionSync', async (importOriginal) => {
	const actual = await importOriginal<typeof import('features/TransactionSync')>();
	return { ...actual, LazyArweaveTransactionSync: () => null };
});

const ASSET_ID = 'a'.repeat(43);
const COLLECTION_ID = 'k'.repeat(43);
const SELLER = 's'.repeat(43);
const OTHER = 'c'.repeat(43);
const BUYER = 'b'.repeat(43);

function order(id: string, creator: string, quantity: string, asking: string): SwapOrder {
	return {
		orderId: id.repeat(43).slice(0, 43),
		creator,
		recipient: 'q'.repeat(43),
		asking,
		deposit: '0',
		minimumFee: '0',
		deadline: 0,
		createdAt: 1,
		quantity,
		status: 'open',
	};
}

const FIRST = order('o', SELLER, '1000', '5000000000');
const SECOND = order('p', OTHER, '2000', '12000000000');

function assetState(overrides: Partial<AssetState> = {}): AssetState {
	return {
		device: 'token@1.0',
		name: 'Test token',
		ticker: 'TEST',
		denomination: 2,
		totalSupply: '100000',
		balances: { [SELLER]: '5000', [BUYER]: '100' },
		orders: { [FIRST.orderId]: FIRST, [SECOND.orderId]: SECOND },
		swapHeight: 0,
		value: null,
		raw: { 'at-slot': 42 },
		...overrides,
	};
}

const ASSET: AssetSummary = { id: ASSET_ID, name: 'Test Token', ticker: 'TEST' };

let root: Root;
let host: HTMLElement;
let onClose: ReturnType<typeof vi.fn>;
let onRestart: ReturnType<typeof vi.fn>;
let onActivityChange: ReturnType<typeof vi.fn>;

function render(owner: string, operation: FungibleOperation, state = assetState()) {
	React.act(() =>
		root.render(
			<FungibleOperationDialog
				asset={ASSET}
				collectionId={COLLECTION_ID}
				state={state}
				owner={owner}
				operation={operation}
				visible
				restoreFallback={() => null}
				onHide={() => undefined}
				onActivityChange={onActivityChange}
				onRestart={onRestart}
				onClose={onClose}
			/>
		)
	);
}

async function settle(rounds = 8, ms = 0) {
	for (let index = 0; index < rounds; index += 1) {
		await React.act(async () => {
			await new Promise((resolve) => setTimeout(resolve, ms));
		});
	}
}

/** Wait past the purchase quote debounce so the buy action becomes available. */
async function quoted() {
	await settle(3, 150);
}

function submit() {
	const button = host.querySelector<HTMLButtonElement>('button[type="submit"]');
	if (!button) throw new Error('missing submit button');
	React.act(() => button.click());
}

function buttonNamed(label: RegExp) {
	return [...host.querySelectorAll('button')].find((button) => label.test(button.textContent ?? ''));
}

function phaseText() {
	return host.textContent ?? '';
}

beforeEach(() => {
	localStorage.clear();
	mocks.calls = [];
	mocks.restoreFails = false;
	mocks.settlementFails = false;
	mocks.waitFailure = null;
	mocks.freshState = assetState();
	mocks.released = { claim: 0, network: 0 };
	onClose = vi.fn();
	onRestart = vi.fn();
	onActivityChange = vi.fn();
	window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
	vi.spyOn(HTMLElement.prototype, 'getClientRects').mockImplementation(function (this: HTMLElement) {
		return (this.isConnected && !this.closest('[hidden]') ? [{}] : []) as unknown as DOMRectList;
	});
	host = document.createElement('div');
	document.body.append(host);
	root = createRoot(host);
});

afterEach(async () => {
	React.act(() => root.unmount());
	await settle(1);
	host.remove();
	vi.restoreAllMocks();
});

describe('FungibleOperationDialog', () => {
	it('lists tokens: revalidates state, saves recovery, dispatches, and clears recovery on success', async () => {
		render(SELLER, { kind: 'sell', quantity: '5', unitPrice: '0.01' });
		expect(host.querySelector('.trade-form')).not.toBeNull();
		submit();
		expect(host.querySelector('.operation-working')).not.toBeNull();
		await settle();
		expect(mocks.calls).toEqual(['makeOffer', 'dispatchAndConfirm', 'waitForOfferAcceptance']);
		expect(host.querySelector('.result.success')).not.toBeNull();
		expect(phaseText()).toContain('Tokens listed');
		expect(localStorage.getItem(`bazar-operation:${ASSET_ID}:${SELLER}`)).toBeNull();
		expect(mocks.released.claim).toBe(1);
		expect(onActivityChange.mock.calls.at(-1)?.[0]).toMatchObject({ phase: 'done' });
	});

	it('keeps a signed listing resumable after a failure', async () => {
		mocks.waitFailure = 'unknown';
		render(SELLER, { kind: 'sell', quantity: '5', unitPrice: '0.01' });
		submit();
		await settle();
		expect(host.querySelector('.result.error')).not.toBeNull();
		expect(buttonNamed(/Resume the signed transaction/)).toBeDefined();
		expect(localStorage.getItem(`bazar-operation:${ASSET_ID}:${SELLER}`)).toContain('M'.repeat(43));

		mocks.waitFailure = null;
		mocks.calls = [];
		React.act(() => buttonNamed(/Resume the signed transaction/)?.click());
		await settle();
		// The saved transaction is reused instead of signing a replacement.
		expect(mocks.calls).toEqual(['dispatchAndConfirm', 'waitForOfferAcceptance']);
		expect(host.querySelector('.result.success')).not.toBeNull();
	});

	it('discards a rejected transfer signature so a new one can be signed', async () => {
		mocks.waitFailure = 'rejected';
		const key = `bazar-operation:${ASSET_ID}:${SELLER}`;
		render(SELLER, { kind: 'transfer', quantity: '5', recipient: OTHER });
		submit();
		await settle();
		expect(host.querySelector('.result.error')).not.toBeNull();
		// A rejection proves the transfer cannot apply, so nothing stays saved.
		expect(localStorage.getItem(key)).toBeNull();
		expect(localStorage.getItem(`bazar-signed-transaction:${'X'.repeat(43)}`)).toBeNull();
		expect(buttonNamed(/Try again/)).toBeDefined();

		React.act(() => buttonNamed(/Try again/)?.click());
		expect(host.querySelector('.trade-form')).not.toBeNull();
	});

	it('refuses to sign when live state changed before approval', async () => {
		mocks.freshState = assetState({ orders: {} });
		render(SELLER, { kind: 'cancel', order: FIRST });
		submit();
		await settle();
		expect(mocks.calls).toEqual([]);
		expect(host.querySelector('.result.error')).not.toBeNull();
		expect(buttonNamed(/View updated token/)).toBeDefined();
		expect(mocks.released.claim).toBe(1);
	});

	it('resumes a saved signed transfer as soon as it opens', async () => {
		render(SELLER, {
			kind: 'transfer',
			quantity: '2',
			recipient: OTHER,
			startingSlot: 40,
			resumeId: 'X'.repeat(43),
		});
		expect(host.querySelector('.operation-working')).not.toBeNull();
		await settle();
		expect(mocks.calls).toEqual(['restore', 'dispatchAndConfirm', 'waitForFungibleTransfer']);
		expect(host.querySelector('.result.success')).not.toBeNull();
		expect(phaseText()).toContain('Transfer complete');
	});

	it('settles a two-listing purchase and clears its saved batch', async () => {
		render(BUYER, { kind: 'buy', availableOrders: [FIRST, SECOND], quantity: '25', startingBalance: '100' });
		await quoted();
		expect(host.querySelector('.purchase-confirmation')).not.toBeNull();
		submit();
		await settle();
		expect(mocks.calls[0]).toBe('preparePurchaseBatch');
		expect(host.querySelector('.result.success')).not.toBeNull();
		expect(phaseText()).toContain('Purchase complete');
		expect(host.querySelector('.settlement-receipts')).not.toBeNull();
		expect(localStorage.getItem(`bazar-purchase-batch:${ASSET_ID}:${BUYER}`)).toBeNull();
		expect(mocks.released.claim).toBe(1);
	});

	it('keeps the saved batch and shows per-listing recovery when one lot fails', async () => {
		mocks.settlementFails = true;
		render(BUYER, { kind: 'buy', availableOrders: [FIRST, SECOND], quantity: '25', startingBalance: '100' });
		await quoted();
		submit();
		await settle();
		expect(host.querySelector('.result.error')).not.toBeNull();
		expect(host.querySelectorAll('[role="tab"]')).toHaveLength(2);
		expect(localStorage.getItem(`bazar-purchase-batch:${ASSET_ID}:${BUYER}`)).toContain('R0');
		// One lot failed and its sibling stopped at the shared payment barrier, so both still need settling.
		expect(buttonNamed(/Resume 2 incomplete settlements/)).toBeDefined();

		React.act(() => buttonNamed(/Resume 2 incomplete settlements/)?.click());
		expect(onRestart).toHaveBeenCalledTimes(1);
		expect(mocks.released.network).toBeGreaterThan(0);
	});

	it('abandons in-flight settlement work and releases the wallet claim when it unmounts', async () => {
		render(BUYER, { kind: 'buy', availableOrders: [FIRST], quantity: '10', startingBalance: '100' });
		await quoted();
		submit();
		await React.act(async () => {
			await Promise.resolve();
		});
		React.act(() => root.unmount());
		await settle(2);
		expect(mocks.released.claim).toBeGreaterThan(0);
		expect(mocks.released.network).toBeGreaterThan(0);
		root = createRoot(host);
	});
});
