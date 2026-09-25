// @vitest-environment jsdom
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Operation } from 'api/operations';

import OperationDialog from 'features/Operations/components/organisms/OperationDialog/OperationDialog';
import { appError } from 'helpers/app-error';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
	estimate: vi.fn(),
	balance: vi.fn(),
	readAssetState: vi.fn(),
	discoverPendingAssetOffers: vi.fn(),
	makeOffer: vi.fn(),
	dispatchAndConfirm: vi.fn(),
	waitForOfferAcceptance: vi.fn(),
	acquireClaim: vi.fn(),
	purchaseRun: vi.fn(),
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
	acquireWalletOperationClaim: (...args: unknown[]) => mocks.acquireClaim(...args),
}));
vi.mock('api/profile', async (importOriginal) => ({
	...(await importOriginal<typeof import('api/profile')>()),
	readAccountProfile: () => new Promise(() => undefined),
}));
vi.mock('api/transactions', async (importOriginal) => ({
	...(await importOriginal<typeof import('api/transactions')>()),
	loadAtomicTransactionRuntime: async () => ({
		AssetTransactionClient: class {
			estimatePurchaseCosts(...args: unknown[]) {
				return mocks.estimate(...args);
			}
			walletBalance(...args: unknown[]) {
				return mocks.balance(...args);
			}
			makeOffer(...args: unknown[]) {
				return mocks.makeOffer(...args);
			}
			purchaseAdapter() {
				return { restorePrepared: async () => undefined, preparePayment: async () => undefined };
			}
			waitForOfferAcceptance(...args: unknown[]) {
				return mocks.waitForOfferAcceptance(...args);
			}
		},
		SwapPurchase: class {
			on() {
				return () => undefined;
			}
			state() {
				return { stage: 'idle' };
			}
			snapshot() {
				return {};
			}
			run() {
				return mocks.purchaseRun();
			}
			abandon() {
				return undefined;
			}
			skip() {
				return undefined;
			}
		},
		acquireAssetObserverNetwork: () => ({ ready: Promise.resolve(), network: {}, release: () => undefined }),
		dispatchAndConfirm: (...args: unknown[]) => mocks.dispatchAndConfirm(...args),
	}),
	continuePaymentConfirmations: () => ({ stop: () => undefined }),
}));
vi.mock('features/TransactionSync', async (importOriginal) => ({
	...(await importOriginal<typeof import('features/TransactionSync')>()),
	LazyArweaveTransactionSync: (props: { activeStep?: string; steps: Array<{ key: string }> }) => (
		<div className="transaction-sync" data-active-step={props.activeStep} data-steps={props.steps.length} />
	),
}));

const OWNER = 'O'.repeat(43);
const SELLER = 'S'.repeat(43);
const RECIPIENT = 'R'.repeat(43);
const REGISTRATION = 'G'.repeat(43);
const TRANSACTION = 'T'.repeat(43);
const ASSET = { id: 'A'.repeat(43), name: 'Atomic art' };
const ORDER = {
	orderId: 'D'.repeat(43),
	creator: SELLER,
	recipient: SELLER,
	asking: '1000000000000',
	quantity: '1',
	status: 'open',
} as any;
const ESTIMATE = {
	asking: ORDER.asking,
	total: '1200000000000',
	registrationFee: '0',
	registrationNetworkReward: '0',
	paymentNetworkReward: '0',
};

let root: Root;
let host: HTMLElement;
const onClose = vi.fn();
const onHide = vi.fn();
const onOperation = vi.fn();
const onUpdate = vi.fn();
const onViewAsset = vi.fn();

function dialog(operation: Operation) {
	return (
		<OperationDialog
			asset={ASSET}
			collectionId="collection-1"
			operation={operation}
			owner={OWNER}
			restoreFallback={() => null}
			taskId="task-1"
			visible
			onClose={onClose}
			onHide={onHide}
			onOperation={onOperation}
			onUpdate={onUpdate}
			onViewAsset={onViewAsset}
		/>
	);
}

async function flush(times = 8) {
	for (let index = 0; index < times; index += 1) {
		await React.act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 0));
		});
	}
}

async function render(operation: Operation) {
	await React.act(async () => root.render(dialog(operation)));
	await flush();
}

function text() {
	return host.textContent ?? '';
}

function button(label: string) {
	const match = [...host.querySelectorAll('button')].find(
		(element) => element.textContent?.includes(label) || element.getAttribute('aria-label') === label
	);
	if (!match) throw new Error(`missing button ${label}`);
	return match;
}

async function click(label: string) {
	const target = button(label);
	await React.act(async () => {
		target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
	});
	await flush();
}

async function type(value: string) {
	const input = host.querySelector('input');
	if (!input) throw new Error('missing input');
	const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
	await React.act(async () => {
		setter?.call(input, value);
		input.dispatchEvent(new Event('input', { bubbles: true }));
	});
	await flush(1);
}

async function submit() {
	const form = host.querySelector('form');
	if (!form) throw new Error('missing form');
	await React.act(async () => {
		form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
	});
	await flush();
}

beforeEach(() => {
	localStorage.clear();
	vi.clearAllMocks();
	host = document.createElement('div');
	document.body.append(host);
	root = createRoot(host);
	window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
	mocks.estimate.mockResolvedValue(ESTIMATE);
	mocks.balance.mockResolvedValue(5_000_000_000_000n);
	mocks.readAssetState.mockResolvedValue({
		state: { balances: { [OWNER]: '1' }, orders: {}, raw: { 'at-slot': '12' } },
	});
	mocks.discoverPendingAssetOffers.mockResolvedValue([]);
	mocks.makeOffer.mockResolvedValue({ id: TRANSACTION });
	mocks.dispatchAndConfirm.mockResolvedValue(undefined);
	mocks.waitForOfferAcceptance.mockResolvedValue(undefined);
	mocks.acquireClaim.mockImplementation(async (storage: Storage, key: string) => {
		storage.setItem(key, JSON.stringify({ attemptId: 'attempt-1', createdAt: 1 }));
		return { key, attemptId: 'attempt-1', releaseLock: () => undefined };
	});
});

afterEach(async () => {
	await React.act(async () => root.unmount());
	await flush(1);
	host.remove();
	localStorage.clear();
});

describe('operation dialog', () => {
	it('blocks the purchase until the exact cost has been checked', async () => {
		mocks.estimate.mockReturnValue(new Promise(() => undefined));
		await render({ kind: 'buy', order: ORDER });

		expect(text()).toContain('Checking wallet balance and network fees');
		expect(button('Checking purchase costs…').getAttribute('disabled')).not.toBeNull();
	});

	it('shows a declared reservation minimum inside the total fees', async () => {
		await render({ kind: 'buy', order: { ...ORDER, minimumFee: '300000000000' } });

		expect(text()).toContain('Reservation minimum (included)0.3 $AR');
		expect(text()).toContain('Total fees');
		expect(text()).not.toContain('Network fees');
	});

	it('shows the exact purchase cost once it is known', async () => {
		await render({ kind: 'buy', order: ORDER });

		expect(text()).toContain('Costs checked.');
		expect(text()).toContain('Buy · up to 1.2 $AR');
		expect(text()).toContain('Maximum total1.2 $AR');
		expect(text()).toContain('Wallet after purchase3.8 $AR');
		expect(button('Buy').getAttribute('disabled')).toBeNull();
	});

	it('re-checks the cost on request after a failed check', async () => {
		mocks.estimate.mockRejectedValueOnce(appError('compute-unavailable'));
		await render({ kind: 'buy', order: ORDER });
		expect(text()).toContain('Arweave network fees are unavailable. Retry the cost check before buying.');

		await click('Retry cost check');
		expect(mocks.estimate).toHaveBeenCalledTimes(2);
		expect(text()).toContain('Costs checked.');
		expect(text()).toContain('Refresh costs');
	});

	it('does not offer a retry for a listing the seller must correct', async () => {
		mocks.estimate.mockRejectedValue(appError('asset-purchase-registration-fee-too-high'));
		await render({ kind: 'buy', order: ORDER });

		expect(text()).toContain('The seller needs to relist the asset with a lower fee.');
		expect(text()).not.toContain('Retry cost check');
		expect(button('Listing needs an update').getAttribute('disabled')).not.toBeNull();
	});

	it('blocks a purchase the wallet cannot afford', async () => {
		mocks.balance.mockResolvedValue(1n);
		await render({ kind: 'buy', order: ORDER });

		expect(text()).toContain('Wallet after purchaseInsufficient $AR');
		expect(text()).toContain('This wallet has insufficient $AR.');
		expect(button('Insufficient $AR').getAttribute('disabled')).not.toBeNull();
	});

	it('offers a cost re-check when the quote is unavailable', async () => {
		mocks.estimate.mockRejectedValue(appError('compute-unavailable'));
		await render({ kind: 'buy', order: ORDER });

		expect(text()).toContain('Arweave network fees are unavailable. Retry the cost check before buying.');
		expect(host.querySelector('.inline-error')).not.toBeNull();
		expect(button('Cost check unavailable').getAttribute('disabled')).not.toBeNull();
	});

	it('validates a listing price before anything is signed', async () => {
		await render({ kind: 'sell' });
		expect(button('Enter a listing price').getAttribute('disabled')).not.toBeNull();

		await type('0');
		expect(host.querySelector('.field-help-error')?.textContent).toContain('Enter a price of at least');
		expect(host.querySelector('input')?.getAttribute('aria-invalid')).toBe('true');

		await type('1.5');
		expect(host.querySelector('.field-help-error')).toBeNull();
		expect(button('List for 1.5 $AR').getAttribute('disabled')).toBeNull();
		expect(mocks.makeOffer).not.toHaveBeenCalled();
	});

	it('reviews the exact transfer recipient before asking for an approval', async () => {
		await render({ kind: 'transfer' });
		await type('not-an-address');
		expect(text()).toContain('43-character Arweave address');
		expect(host.querySelector('.transfer-review')).toBeNull();

		await type(`  ${RECIPIENT} `);
		expect(host.querySelector('.transfer-review')).not.toBeNull();
		expect(button('Send to').getAttribute('disabled')).toBeNull();
	});

	it('follows a listing from submission to its receipt', async () => {
		await render({ kind: 'sell' });
		await type('1.5');
		await submit();

		expect(host.querySelector('.result.success')).not.toBeNull();
		expect(text()).toContain('Listing is live');
		expect(text()).toContain('You listed');
		expect(text()).toContain('1.5 $AR');
		await click('View updated asset');
		expect(onViewAsset).toHaveBeenCalled();
	});

	it('sends the market back to the asset when live state changed', async () => {
		mocks.readAssetState.mockRejectedValue(appError('market-state-changed'));
		await render({ kind: 'sell' });
		await type('2');
		await submit();

		expect(host.querySelector('.result.error')).not.toBeNull();
		expect(text()).toContain('The owner or listing changed');
		await click('View updated asset');
		expect(onClose).toHaveBeenCalledWith(false);
	});

	it('asks for the remaining approval of a saved purchase before continuing it', async () => {
		mocks.purchaseRun.mockReturnValue(new Promise(() => undefined));
		await render({
			kind: 'buy',
			order: ORDER,
			resume: { registration: { id: REGISTRATION, dispatched: true } },
		});

		expect(host.querySelector('.recovery-approval')).not.toBeNull();
		expect(text()).toContain('Continue your purchase');
		expect(text()).toContain('is already signed');
		expect(mocks.acquireClaim).not.toHaveBeenCalled();

		await click('Approve seller payment and continue');
		expect(mocks.acquireClaim).toHaveBeenCalledTimes(1);
		expect(host.querySelector('.purchase-sequence')).not.toBeNull();
	});

	it('hides a working transaction instead of closing it', async () => {
		mocks.dispatchAndConfirm.mockReturnValue(new Promise(() => undefined));
		await render({ kind: 'sell' });
		await type('2');
		await submit();

		await click('Hide transaction details');
		expect(host.querySelector('.operation-side-panel')?.className).toContain('operation-side-panel');
		expect(onClose).not.toHaveBeenCalled();
		await new Promise((resolve) => setTimeout(resolve, 600));
		await flush(1);
		expect(onHide).toHaveBeenCalledTimes(1);
	});
});
