import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  AtomicPurchaseSequence,
  AtomicOperationErrorAlert,
  atomicPurchaseSequence,
  atomicOperationFormError,
  atomicOperationStateError,
  atomicOperationValue,
  atomicOrderCanBeBought,
  atomicPurchaseFailureCode,
  atomicPurchaseFailureStage,
  atomicPurchaseHasTerminalReservationFailure,
  atomicPurchaseRecoveryStatus,
} from './App';

describe('atomic operation error semantics', () => {
  it('keeps transaction recovery outside the assertive alert summary', () => {
    const alert = renderToStaticMarkup(
      React.createElement(AtomicOperationErrorAlert, {
        message: 'The signed transaction is saved in this browser.',
      }),
    );
    expect(alert).toContain('role="alert"');
    expect(alert).not.toContain('<button');
    expect(alert).not.toContain('<a');
    expect(alert).toContain('The signed transaction is saved in this browser.');
  });
});

describe('atomic asset operation validation', () => {
  it('requires a positive AR price with at most twelve decimals', () => {
    expect(atomicOperationFormError('sell', '')).toContain('exact AR price');
    expect(atomicOperationFormError('sell', '0')).toContain('at least');
    expect(atomicOperationFormError('sell', '0.000000000001')).toBe('');
    expect(atomicOperationFormError('sell', '0.0000000000001')).toContain('valid AR amount');
  });

  it('requires an exact Arweave recipient before transfer', () => {
    expect(atomicOperationFormError('transfer', '')).toContain('43-character');
    expect(atomicOperationFormError('transfer', 'too-short')).toContain('valid');
    expect(atomicOperationFormError('transfer', 'BLyLiOZptmb-olB8wycvk_ynHiu1SZMKPqswx4KONwc')).toBe('');
  });

  it('rejects a transfer back to the current owner', () => {
    const owner = 'BLyLiOZptmb-olB8wycvk_ynHiu1SZMKPqswx4KONwc';
    expect(atomicOperationFormError('transfer', owner, owner)).toContain('different wallet');
  });

  it('uses the normalized recipient for the transfer operation', () => {
    expect(atomicOperationValue('transfer', '  BLyLiOZptmb-olB8wycvk_ynHiu1SZMKPqswx4KONwc  ')).toBe(
      'BLyLiOZptmb-olB8wycvk_ynHiu1SZMKPqswx4KONwc',
    );
  });

  it('does not block buy or cancellation forms', () => {
    expect(atomicOperationFormError('buy', '')).toBe('');
    expect(atomicOperationFormError('cancel', '')).toBe('');
  });
});

describe('atomic order actions', () => {
  it('only allows an open order to be bought', () => {
    expect(atomicOrderCanBeBought({ status: 'open' } as any)).toBe(true);
    expect(atomicOrderCanBeBought({ status: 'reserved' } as any)).toBe(false);
    expect(atomicOrderCanBeBought(null)).toBe(false);
  });

  it('rejects stale ownership and order snapshots before approval', () => {
    const owner = 'A'.repeat(43);
    const buyer = 'B'.repeat(43);
    const order = {
      orderId: 'O'.repeat(43),
      creator: owner,
      asking: '100',
      quantity: '1',
      status: 'open',
    } as any;
    const listed = {
      balances: {},
      orders: { [order.orderId]: order },
    } as any;
    expect(atomicOperationStateError('buy', listed, buyer, order)).toBe('');
    expect(atomicOperationStateError('buy', { ...listed, orders: {} }, buyer, order)).toBe('market-state-changed');
    expect(atomicOperationStateError('cancel', listed, owner, order)).toBe('');
    expect(atomicOperationStateError('cancel', listed, buyer, order)).toBe('market-state-changed');
    expect(atomicOperationStateError('transfer', { balances: { [owner]: '1' }, orders: {} } as any, owner, null)).toBe(
      '',
    );
    expect(atomicOperationStateError('transfer', { balances: {}, orders: {} } as any, owner, null)).toBe(
      'market-state-changed',
    );
  });
});

describe('atomic purchase failure trace', () => {
  it('shows NFT-specific purchase stages using the shared sequence styling', () => {
    const steps = atomicPurchaseSequence({ stage: 'payment-confirming' } as any);
    const sequence = renderToStaticMarkup(
      React.createElement(AtomicPurchaseSequence, {
        state: { stage: 'payment-confirming' } as any,
      }),
    );

    expect(steps.map((step) => [step.key, step.label, step.state])).toEqual([
      ['sign', 'Sign reservation', 'done'],
      ['reserve', 'Reserve asset', 'done'],
      ['pay', 'Pay seller', 'active'],
      ['verify', 'Verify ownership', 'next'],
    ]);
    expect(sequence).toContain('aria-label="Asset purchase transaction sequence"');
    expect(sequence).toContain('Reserve asset');
    expect(sequence).toContain('Verify ownership');
  });

  it('keeps reservation signing active until the first NFT transaction is prepared', () => {
    expect(atomicPurchaseSequence({ stage: 'signing' } as any).map((step) => step.state)).toEqual([
      'active',
      'next',
      'next',
      'next',
    ]);
  });

  it('resumes only orders still available to the same buyer', () => {
    const buyer = 'B'.repeat(43);
    const otherBuyer = 'C'.repeat(43);
    const order = {
      orderId: 'O'.repeat(43),
      creator: 'S'.repeat(43),
      asking: '100',
      quantity: '1',
      status: 'open',
    } as any;
    const state = (currentOrder?: any, balances: Record<string, string> = {}) =>
      ({
        balances,
        orders: currentOrder ? { [order.orderId]: currentOrder } : {},
      }) as any;

    expect(atomicPurchaseRecoveryStatus(state(order), buyer, order)).toBe('resumable');
    expect(atomicPurchaseRecoveryStatus(state({ ...order, status: 'reserved', buyer }), buyer, order)).toBe(
      'resumable',
    );
    expect(atomicPurchaseRecoveryStatus(state({ ...order, status: 'reserved', buyer: otherBuyer }), buyer, order)).toBe(
      'blocked',
    );
    expect(atomicPurchaseRecoveryStatus(state(), buyer, order)).toBe('blocked');
    expect(
      atomicPurchaseRecoveryStatus(state(undefined, { [buyer]: '0' }), buyer, order, {
        payment: { id: 'P'.repeat(43), dispatched: true },
      }),
    ).toBe('resumable');
  });

  it('identifies the furthest known settlement stage', () => {
    expect(atomicPurchaseFailureStage(null)).toBe('Before reservation');
    expect(
      atomicPurchaseFailureStage({
        registration: { id: 'reservation', dispatched: false },
      } as any),
    ).toBe('Reservation dispatch');
    expect(
      atomicPurchaseFailureStage({
        registration: { id: 'reservation', dispatched: true },
      } as any),
    ).toBe('Reservation confirmation or acceptance');
    expect(
      atomicPurchaseFailureStage({
        payment: { id: 'payment', dispatched: false },
      } as any),
    ).toBe('Payment release');
    expect(
      atomicPurchaseFailureStage({
        payment: { id: 'payment', dispatched: true },
      } as any),
    ).toBe('Payment confirmation or ownership');
  });

  it('normalizes terminal reservation failures before choosing a recovery action', () => {
    const expired = {
      stage: 'failed',
      error: { code: 'unexpected', message: 'asset-order-reservation-expired' },
    } as any;
    const paymentRejected = {
      stage: 'failed',
      error: { code: 'payment-dispatch-rejected', message: 'invalid payment' },
    } as any;

    expect(atomicPurchaseFailureCode(expired)).toBe('asset-order-reservation-expired');
    expect(atomicPurchaseHasTerminalReservationFailure(expired)).toBe(true);
    expect(atomicPurchaseHasTerminalReservationFailure(paymentRejected)).toBe(false);
  });
});
