import { describe, expect, it } from 'vitest';

import {
  isRejectedTransactionDispatch,
  marketplaceCodedError,
  marketplaceErrorMessage,
  marketplaceFailureKind,
  marketplaceOperationFailure,
  marketplaceRequestFailureMessage,
} from './marketplace-error';

describe('marketplaceErrorMessage', () => {
  it.each([
    ['asset-purchase-insufficient-funds-after-signing', 'saved in this browser with the same wallet'],
    ['transaction-propagation-timeout', 'return with the same wallet and retained browser data'],
    ['asset-state-timeout', 'sampled observers report the transaction as confirmed'],
    ['asset-order-reservation-expired', 'No seller payment was sent'],
    ['asset-order-reservation-rejected', 'stale recovery has been cleared'],
    ['wallet-account-changed', 'Reconnect the original signer to continue'],
    ['wallet-recovery-conflict', 'Resume that action before starting a new one.'],
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
  ] as const)('explains recovery for %s', (code, guidance) => {
    expect(marketplaceErrorMessage(new Error(code))).toContain(guidance);
  });

  it('keeps unknown errors readable', () => {
    expect(marketplaceErrorMessage(new Error('unexpected-market-failure'))).toBe('unexpected market failure');
  });

  it('points observation-window failures at the in-place recovery action', () => {
    for (const code of ['registration not found', 'payment not found']) {
      const message = marketplaceErrorMessage(new Error(code));
      expect(message).toContain('visible Resume action');
      expect(message).not.toContain('Reload');
    }
  });

  it('preserves changed live state as a typed refresh boundary', () => {
    expect(marketplaceOperationFailure(new Error('market-state-changed'))).toBe('market-state-changed');
    expect(marketplaceOperationFailure(new Error('fungible-transfer-rejected'))).toBe('transaction-rejected');
    expect(marketplaceOperationFailure(new Error('asset-cancel-rejected'))).toBe('transaction-rejected');
    expect(marketplaceOperationFailure(new Error('asset-purchase-rejected'))).toBe('transaction-rejected');
    expect(marketplaceOperationFailure(new Error('asset-order-reservation-rejected'))).toBe('transaction-rejected');
    expect(marketplaceOperationFailure(new Error('fungible-transfer-proof-mismatch'))).toBe('other');
    expect(marketplaceOperationFailure(new Error('temporary quote failure'))).toBe('other');
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
    expect(marketplaceRequestFailureMessage('compute', 'rate-limited')).toContain('choose another Compute gateway');
    expect(marketplaceRequestFailureMessage('index', 'rate-limited')).toBe(
      'Arweave’s transaction index is temporarily rate-limiting requests. Wait briefly and retry.',
    );
    expect(marketplaceRequestFailureMessage('compute', 'unavailable')).toContain('Live state could not be read');
    expect(marketplaceRequestFailureMessage('index', 'unavailable')).toBe(
      'Arweave’s transaction index could not be read. Retry shortly.',
    );
  });

  it('keeps a mixed batched index failure classified as rate-limited', () => {
    const failure = new AggregateError(
      [new Error('asset-activity-graphql-503'), new Error('asset-activity-graphql-429')],
      'asset-activity-batch-failed: asset-activity-graphql-429; asset-activity-graphql-503',
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
