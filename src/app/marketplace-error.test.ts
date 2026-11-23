import { describe, expect, it } from 'vitest';

import { MAXIMUM_ASSET_OFFER_PRICE } from 'api/order-matching';

import { formatArAmount } from 'helpers/token-display';

import {
	ASSET_OFFER_PRICE_CAP_ERROR,
	ASSET_OFFER_TOTAL_CAP_ERROR,
	isRejectedTransactionDispatch,
	isTerminalPurchaseFailureCode,
	marketplaceCodedError,
	marketplaceErrorMessage,
	marketplaceFailureKind,
	marketplaceOperationFailure,
	marketplaceRequestFailureMessage,
	NOT_SENT_RECOVERY_NOTE,
	notSentRecoveryCopy,
	purchaseQuoteFailure,
} from './marketplace-error';

describe('purchase cost-check recovery', () => {
	it.each(['asset-purchase-registration-fee-too-high', 'asset-purchase-invalid-registration-fee'])(
		'keeps %s out of the network retry loop',
		(code) => {
			const failure = purchaseQuoteFailure(new Error(code));
			expect(failure.retryable).toBe(false);
			expect(failure.message).toContain('seller');
			expect(failure.message).toContain('reservation fee');
			expect(failure.message).not.toContain('Compute');
		}
	);

	it.each([
		['wallet-balance-503', 'balance'],
		['transaction-price-429', 'network fees'],
		['Failed to fetch', 'connection'],
	])('identifies the retryable cost-check failure %s', (code, detail) => {
		const failure = purchaseQuoteFailure(new Error(code));
		expect(failure.retryable).toBe(true);
		expect(failure.message).toContain(detail);
		expect(failure.message).not.toContain('Compute');
	});
});

describe('marketplaceErrorMessage', () => {
	it.each([
		['browser-storage-full', 'cleared its rebuildable caches'],
		['asset-purchase-insufficient-funds-after-signing', 'saved in this browser with the same wallet'],
		['transaction-propagation-timeout', 'return with the same wallet and retained browser data'],
		['asset-state-timeout', 'sampled observers report the transaction as confirmed'],
		['asset-state-read-timeout', 'No transaction was prepared or sent'],
		['asset-order-reservation-expired', 'start a new purchase'],
		['asset-order-reservation-rejected', 'may have lost a race'],
		['wallet-account-changed', 'Reconnect the original signer to continue'],
		['wallet-recovery-conflict', 'Resume that action before starting a new one.'],
		['asset-balance-state-unavailable', 'did not ask the wallet to approve'],
		['asset-balance-proof-unavailable', 'signed transaction remains saved'],
		['registration not found', 'without signing again.'],
		['payment not found', 'without paying again.'],
		['fungible-transfer-rejected', 'No tokens moved.'],
		['fungible-transfer-proof-mismatch', 'signed transaction is saved in this browser'],
		['asset-cancel-rejected', 'listing changed first'],
		['asset-cancel-proof-mismatch', 'signed transaction is saved in this browser'],
		['asset-purchase-rejected', 'permanent payment evidence'],
		['asset-purchase-proof-mismatch', 'Both transaction IDs remain saved in this browser'],
		['asset-payment-id-missing', 'cannot prove settlement safely'],
		['asset-action-starting-slot-unavailable', 'did not ask the wallet'],
		['asset-action-recovery-baseline-missing', 'cannot reliably infer its outcome'],
		['asset-pending-listing-check-unavailable', 'did not ask your wallet to sign'],
	] as const)('explains recovery for %s', (code, guidance) => {
		expect(marketplaceErrorMessage(new Error(code))).toContain(guidance);
	});

	it.each([
		['asset-offer-asking-too-high', '66,000,000 AR maximum'],
		['invalid-asset-offer-asking', 'at least 0.000000000001 AR'],
		['wallet-sign-unavailable', 'Connect an Arweave wallet that can sign transactions.'],
		['wallet-returned-unsigned-transaction', 'did not return a signed transaction'],
		['wallet-returned-invalid-signature', 'signature that does not verify'],
	] as const)('explains the pre-dispatch listing or signing failure %s', (code, guidance) => {
		const message = marketplaceErrorMessage(new TypeError(code));
		expect(message).toContain(guidance);
		expect(message).toContain('No transaction was submitted.');
		expect(message).not.toBe(code.replaceAll('-', ' '));
	});

	it.each(['wallet-modified-transaction-fields', 'wallet-modified-transaction-data'])(
		'explains that Bazar refused to submit a transaction the wallet altered (%s)',
		(code) => {
			for (const error of [new Error(code), marketplaceCodedError('transaction-dispatch-not-sent', code)]) {
				const message = marketplaceErrorMessage(error);
				expect(message).toContain('Bazar did not submit it');
				expect(message).not.toBe(code.replaceAll('-', ' '));
			}
		}
	);

	it('states the listing cap that makeOffer enforces', () => {
		const cap = `${formatArAmount(MAXIMUM_ASSET_OFFER_PRICE)} AR`;
		expect(ASSET_OFFER_PRICE_CAP_ERROR).toContain(cap);
		expect(ASSET_OFFER_TOTAL_CAP_ERROR).toContain(cap);
		expect(marketplaceErrorMessage(new TypeError('asset-offer-asking-too-high'))).toContain(cap);
	});

	it('keeps unknown errors readable', () => {
		expect(marketplaceErrorMessage(new Error('unexpected-market-failure'))).toBe('unexpected market failure');
	});

	it('explains that observation-window failures continue automatically', () => {
		for (const code of ['registration not found', 'payment not found']) {
			const message = marketplaceErrorMessage(new Error(code));
			expect(message).toContain('keep checking');
			expect(message).toContain('automatically');
			expect(message).not.toContain('visible Resume action');
			expect(message).not.toContain('Reload');
		}
	});

	it('preserves changed live state as a typed refresh boundary', () => {
		expect(marketplaceOperationFailure(new Error('market-state-changed'))).toBe('market-state-changed');
		expect(marketplaceOperationFailure(new Error('fungible-transfer-rejected'))).toBe('transaction-rejected');
		expect(marketplaceOperationFailure(new Error('asset-cancel-rejected'))).toBe('transaction-rejected');
		expect(marketplaceOperationFailure(new Error('asset-purchase-rejected'))).toBe('transaction-rejected');
		expect(marketplaceOperationFailure(new Error('asset-order-reservation-rejected'))).toBe('transaction-rejected');
		expect(marketplaceOperationFailure(new Error('asset-order-reservation-expired'))).toBe('transaction-rejected');
		expect(marketplaceOperationFailure(new Error('fungible-transfer-proof-mismatch'))).toBe('other');
		expect(marketplaceOperationFailure(new Error('asset-balance-proof-unavailable'))).toBe('other');
		expect(marketplaceOperationFailure(new Error('temporary quote failure'))).toBe('other');
		expect(
			marketplaceOperationFailure(
				Object.assign(new Error('asset-purchase-insufficient-funds'), {
					code: 'transaction-dispatch-not-sent',
				})
			)
		).toBe('transaction-not-sent');
	});

	it('does not claim a different buyer won when current state only proves the reservation is inactive', () => {
		expect(marketplaceErrorMessage(new Error('asset-order-reservation-rejected'))).not.toContain(
			'Another buyer claimed'
		);
	});

	it('retains structured lifecycle rejection codes through user-facing copy', () => {
		const failure = marketplaceCodedError('payment-dispatch-rejected', 'invalid payment');
		expect(marketplaceOperationFailure(failure)).toBe('transaction-rejected');
		expect(marketplaceErrorMessage(failure)).toContain('reservation may still be active');
	});
});

describe('marketplace request failures', () => {
	it.each([
		['HTTP 429', 'rate-limited'],
		['asset-support-graphql-429', 'rate-limited'],
		['collection-activity-graphql-429', 'rate-limited'],
		['asset-discovery-graphql-503', 'unavailable'],
	] as const)('classifies %s as %s', (error, kind) => {
		expect(marketplaceFailureKind(new Error(error))).toBe(kind);
	});

	it('distinguishes compute and transaction-index recovery', () => {
		expect(marketplaceRequestFailureMessage('compute', 'rate-limited')).toContain(
			'review the AO Core settings in the header'
		);
		expect(marketplaceRequestFailureMessage('index', 'rate-limited')).toBe(
			'Arweave’s transaction index is temporarily rate-limiting requests. Wait briefly and retry.'
		);
		expect(marketplaceRequestFailureMessage('compute', 'unavailable')).toContain('Live state could not be read');
		expect(marketplaceRequestFailureMessage('index', 'unavailable')).toBe(
			'Arweave’s transaction index could not be read. Retry shortly.'
		);
	});

	it('keeps a mixed batched index failure classified as rate-limited', () => {
		const failure = new AggregateError(
			[new Error('asset-activity-graphql-503'), new Error('asset-activity-graphql-429')],
			'asset-activity-batch-failed: asset-activity-graphql-429; asset-activity-graphql-503'
		);
		expect(marketplaceFailureKind(failure)).toBe('rate-limited');
	});
});

describe('isRejectedTransactionDispatch', () => {
	it('recognizes terminal HTTP rejections', () => {
		expect(isRejectedTransactionDispatch('transaction dispatch 400')).toBe(true);
		expect(isRejectedTransactionDispatch('transaction dispatch 422')).toBe(true);
		expect(isRejectedTransactionDispatch(marketplaceCodedError('transaction-dispatch-rejected'))).toBe(true);
	});

	it('keeps ambiguous failures resumable', () => {
		for (const status of [403, 408, 425, 429, 499]) {
			expect(isRejectedTransactionDispatch(`transaction dispatch ${status}`)).toBe(false);
		}
		expect(isRejectedTransactionDispatch('transaction dispatch 500')).toBe(false);
		expect(isRejectedTransactionDispatch('transaction propagation timeout')).toBe(false);
		expect(isRejectedTransactionDispatch('payment not found')).toBe(false);
	});
});

describe('terminal purchase failures', () => {
	it('treats only a process rejection after payment as terminal', () => {
		expect(isTerminalPurchaseFailureCode('asset-purchase-rejected')).toBe(true);
		for (const code of [
			'asset-purchase-proof-mismatch',
			'asset-balance-proof-unavailable',
			'payment-not-found',
			'unexpected',
			'',
			null,
			undefined,
		]) {
			expect(isTerminalPurchaseFailureCode(code)).toBe(false);
		}
	});

	it('keeps proof-mismatch copy consistent with resuming the saved purchase', () => {
		expect(marketplaceErrorMessage(new Error('asset-purchase-proof-mismatch'))).toContain('continue here');
		expect(marketplaceErrorMessage(new Error('asset-purchase-rejected'))).toContain('remains saved for review');
	});
});

describe('not-sent recovery copy', () => {
	it('names the signed operation instead of calling every signature a transfer', () => {
		expect(notSentRecoveryCopy('sell')).toEqual({
			retry: 'Retry listing',
			discard: 'Discard listing',
			changed: 'This saved listing changed in another tab. Close this panel and review the active action.',
		});
		expect(notSentRecoveryCopy('cancel').discard).toBe('Discard cancellation');
		expect(notSentRecoveryCopy('transfer').retry).toBe('Retry transfer');
		expect(NOT_SENT_RECOVERY_NOTE).toBe(
			'No transaction was submitted. Retry this signature or discard it to start over.'
		);
	});
});
