import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { AssetState, SwapOrder } from 'api/asset-marketplace';
import {
  batchPaymentBarrierState,
  batchPurchaseRecoveryApprovalCount,
  batchPurchaseStartingBalance,
  batchRecoveryFrameBuffer,
  batchRecoveryIdentity,
  batchSettlementSummary,
  fungibleOrderActionLabel,
  fungibleListingAccessibleLabel,
  FungibleOperationErrorAlert,
  FungibleSettlementRecoveryPanel,
  FungiblePurchaseReceiptNavigator,
  MatchedListingsReview,
  fungibleOperationStateError,
  fungibleBatchRecoveryStatus,
  fungibleTransferRecipientError,
  fungibleTransferSubmitLabel,
  fungibleWorkingIntro,
  isRecoverableBatch,
  latestRecoverableSnapshot,
  LOT_PICKER_PAGE_SIZE,
  lotOptionTabIndex,
  nextLotPickerLimit,
  nextSettlementAnnouncement,
  purchaseStateFrameBuffer,
  settlementTabIndex,
  storeBatchRecoveryBeforeDispatch,
  visibleOrderbookRows,
  visibleLotPickerOrders,
  waitForSettlementBatch,
} from './FungibleAssetView';
import type { PurchaseSnapshot, PurchaseState } from 'weave-wrangler';

const BUYER = 'b'.repeat(43);
const ORDER_ID = 'o'.repeat(43);
const REGISTRATION_ID = 'r'.repeat(43);
const PAYMENT_ID = 'p'.repeat(43);

describe('fungible operation error semantics', () => {
  it('counts only the new wallet approvals missing from a recovered batch', () => {
    expect(
      batchPurchaseRecoveryApprovalCount([
        {
          snapshot: {
            registration: { id: REGISTRATION_ID, dispatched: true },
            payment: { id: PAYMENT_ID, dispatched: false },
          },
        },
        { snapshot: { registration: { id: REGISTRATION_ID, dispatched: true } } },
        { snapshot: {} },
      ]),
    ).toBe(3);
  });

  it('bounds the initial order book without changing its complete market truth', () => {
    const orders = Array.from({ length: 5_000 }, (_, index) => ({ orderId: `order-${index}` }));
    expect(visibleOrderbookRows(orders, 50)).toEqual(orders.slice(0, 50));
    expect(visibleOrderbookRows(orders, 100)).toEqual(orders.slice(0, 100));
    expect(orders).toHaveLength(5_000);
  });

  it('keeps a 512-order completion bounded while every exact receipt remains selectable', () => {
    const orders = Array.from({ length: 512 }, (_, index) => ({
      asking: `${index + 1}`,
      creator: `${String(index).padStart(42, '0')}A`,
      orderId: `${String(index).padStart(42, '0')}O`,
      quantity: '1',
    })) as SwapOrder[];
    const purchaseStates = Object.fromEntries(
      orders.map((order, index) => [
        order.orderId,
        {
          registration: { id: `${String(index).padStart(42, '0')}R`, views: [] },
          payment: { id: `${String(index).padStart(42, '0')}P`, views: [] },
        },
      ]),
    ) as unknown as Record<string, PurchaseState>;
    const receipt = renderToStaticMarkup(
      React.createElement(FungiblePurchaseReceiptNavigator, {
        activeOrderId: orders[511].orderId,
        onSelect: () => undefined,
        orders,
        purchaseStates,
        state: { denomination: 0, ticker: 'WEAVE' } as AssetState,
      }),
    );
    expect(receipt.match(/<section/g)).toHaveLength(1);
    expect(receipt.match(/<option/g)).toHaveLength(512);
    expect(receipt).toContain('Settlement receipt 512 of 512');
    expect(receipt).toContain(orders[511].creator);
    expect(receipt).toContain(purchaseStates[orders[511].orderId].registration?.id);
    expect(receipt).toContain(purchaseStates[orders[511].orderId].payment?.id);
    expect(receipt).not.toContain(orders[0].creator);
    const nextButton = receipt.match(/<button[^>]*>Next receipt<\/button>/)?.[0] ?? '';
    expect(nextButton).toContain('aria-disabled="true"');
    expect(nextButton).not.toMatch(/\sdisabled(?:=|\s|>)/);

    const firstReceipt = renderToStaticMarkup(
      React.createElement(FungiblePurchaseReceiptNavigator, {
        activeOrderId: orders[0].orderId,
        onSelect: () => undefined,
        orders: orders.slice(0, 2),
        purchaseStates,
        state: { denomination: 0, ticker: 'WEAVE' } as AssetState,
      }),
    );
    const previousButton = firstReceipt.match(/<button[^>]*>Previous receipt<\/button>/)?.[0] ?? '';
    expect(previousButton).toContain('aria-disabled="true"');
    expect(previousButton).not.toMatch(/\sdisabled(?:=|\s|>)/);
  });

  it('makes every matched seller reachable through one bounded keyboard region', () => {
    const orders = Array.from({ length: 512 }, (_, index) => ({
      asking: '1',
      creator: `${String(index).padStart(42, '0')}A`,
      orderId: `${String(index).padStart(42, '0')}O`,
      quantity: '1',
    })) as SwapOrder[];
    const review = renderToStaticMarkup(
      React.createElement(MatchedListingsReview, {
        matchMode: 'amount',
        orders,
        state: { denomination: 0, ticker: 'WEAVE' } as AssetState,
      }),
    );
    expect(review).toContain('Review 512 matched listings');
    expect(review).toContain('aria-label="Exact matched seller addresses"');
    expect(review.match(/tabindex="0"/g)).toHaveLength(1);
    expect(review).toContain(orders[511].creator);
  });

  it('keeps interactive settlement recovery outside the assertive alert summary', () => {
    const alert = renderToStaticMarkup(
      React.createElement(FungibleOperationErrorAlert, {
        message: 'One settlement needs attention.',
      }),
    );
    expect(alert).toContain('role="alert"');
    expect(alert).not.toContain('role="tablist"');
    expect(alert).not.toContain('<button');
    expect(alert).toContain('One settlement needs attention.');
  });

  it('puts explanatory settlement recovery content in sequential focus order', () => {
    const panel = renderToStaticMarkup(
      React.createElement(
        FungibleSettlementRecoveryPanel,
        { orderId: ORDER_ID },
        React.createElement('p', null, 'This incomplete listing can be resumed safely.'),
      ),
    );
    expect(panel).toContain('role="tabpanel"');
    expect(panel).toContain('tabindex="0"');
    expect(panel).toContain(`aria-labelledby="settlement-error-tab-${ORDER_ID}"`);
    expect(panel).toContain('id="fungible-settlement-error-panel"');
    expect(panel).toContain('This incomplete listing can be resumed safely.');
  });
});

function recoveryBatch() {
  return {
    version: 2 as const,
    buyer: BUYER,
    startingBalance: '0',
    entries: [
      {
        order: {
          orderId: ORDER_ID,
          quantity: '1000',
          asking: '2000',
        } as SwapOrder,
        snapshot: { registration: { id: REGISTRATION_ID, dispatched: false } },
        paymentCost: '100',
      },
    ],
  };
}

describe('fungible batch payment coordination', () => {
  it('coalesces a 512-lot observer wave into one visual state commit', () => {
    const frames: Array<() => void> = [];
    const commits: Array<Record<string, PurchaseState>> = [];
    const buffer = purchaseStateFrameBuffer(
      (updates) => commits.push(updates),
      (callback) => {
        frames.push(callback);
        return frames.length;
      },
      () => undefined,
    );
    for (let index = 0; index < 512; index += 1) {
      buffer.push(`order-${index}`, { stage: 'registration-confirming', updatedAt: index } as PurchaseState);
    }
    buffer.push('order-511', { stage: 'payment-confirming', updatedAt: 513 } as PurchaseState);

    expect(frames).toHaveLength(1);
    expect(commits).toHaveLength(0);
    frames[0]();
    expect(commits).toHaveLength(1);
    expect(Object.keys(commits[0])).toHaveLength(512);
    expect(commits[0]['order-511']).toMatchObject({ stage: 'payment-confirming', updatedAt: 513 });
  });

  it('flushes a terminal settlement state before its scheduled frame', () => {
    const frames: Array<() => void> = [];
    const cancelled: number[] = [];
    const commits: Array<Record<string, PurchaseState>> = [];
    const buffer = purchaseStateFrameBuffer(
      (updates) => commits.push(updates),
      (callback) => {
        frames.push(callback);
        return 17;
      },
      (handle) => cancelled.push(handle),
    );
    buffer.push(ORDER_ID, { stage: 'complete', success: true } as PurchaseState);
    buffer.flush();

    expect(cancelled).toEqual([17]);
    expect(commits).toHaveLength(1);
    expect(commits[0][ORDER_ID]).toMatchObject({ stage: 'complete', success: true });
    frames[0]();
    expect(commits).toHaveLength(1);
  });

  it('uses the fresh pre-approval balance for a new batch and the persisted baseline for recovery', () => {
    const freshState = {
      balances: { [BUYER]: '10' },
    } as AssetState;
    const newBaseline = batchPurchaseStartingBalance(undefined, freshState, BUYER, '0');

    expect(newBaseline).toBe('10');
    expect(BigInt(newBaseline) + 3n).toBe(13n);
    expect(batchPurchaseStartingBalance({ startingBalance: '7' }, freshState, BUYER, '0')).toBe('7');
  });

  it('resumes only batch orders still available to the same buyer', () => {
    const resume = recoveryBatch();
    const openOrder = { ...resume.entries[0].order, status: 'open' } as SwapOrder;
    const state = (orders: Record<string, SwapOrder>, balance = '0') =>
      ({
        balances: { [BUYER]: balance },
        orders,
      }) as AssetState;

    expect(fungibleBatchRecoveryStatus(resume, state({ [ORDER_ID]: openOrder }), BUYER)).toBe('resumable');
    expect(
      fungibleBatchRecoveryStatus(
        resume,
        state({ [ORDER_ID]: { ...openOrder, status: 'reserved', buyer: BUYER } }),
        BUYER,
      ),
    ).toBe('resumable');
    expect(
      fungibleBatchRecoveryStatus(
        resume,
        state({ [ORDER_ID]: { ...openOrder, status: 'reserved', buyer: 'x'.repeat(43) } }),
        BUYER,
      ),
    ).toBe('blocked');
    expect(fungibleBatchRecoveryStatus(resume, state({}), BUYER)).toBe('blocked');
    (resume.entries[0].snapshot as PurchaseSnapshot).payment = { id: PAYMENT_ID, dispatched: true };
    expect(fungibleBatchRecoveryStatus(resume, state({}, '0'), BUYER)).toBe('resumable');
  });

  it('announces bounded milestones rather than every sibling transition', () => {
    let key = '';
    const messages: string[] = [];
    for (let settled = 0; settled <= 512; settled += 1) {
      const next = nextSettlementAnnouncement(key, true, 512, { failed: 0, settled });
      if (!next) continue;
      key = next.key;
      messages.push(next.message);
    }
    expect(messages).toEqual([
      'Watching 512 parallel settlements.',
      '128 of 512 settlements complete.',
      '256 of 512 settlements complete.',
      '384 of 512 settlements complete.',
      'All 512 settlements are complete.',
    ]);
    const failure = nextSettlementAnnouncement(key, true, 512, { failed: 1, settled: 400 });
    expect(failure?.message).toContain('needs attention');
    expect(nextSettlementAnnouncement(failure!.key, true, 512, { failed: 27, settled: 401 })).toBeNull();
  });

  it('distinguishes recovery attempts for the same order by their signed transactions', () => {
    const order = { orderId: 'order' } as SwapOrder;
    expect(
      batchRecoveryIdentity([{ order, snapshot: { registration: { id: 'registration-a', dispatched: false } } }]),
    ).not.toBe(
      batchRecoveryIdentity([{ order, snapshot: { registration: { id: 'registration-b', dispatched: false } } }]),
    );
  });

  it('waits for every sibling before reporting a batch failure', async () => {
    let resolveSibling!: (state: PurchaseState) => void;
    const sibling = new Promise<PurchaseState>((resolve) => {
      resolveSibling = resolve;
    });
    let reported = false;
    const result = waitForSettlementBatch([Promise.reject(new Error('reservation failed')), sibling]).catch((cause) => {
      reported = true;
      throw cause;
    });

    await Promise.resolve();
    expect(reported).toBe(false);
    resolveSibling({ stage: 'complete', success: true } as PurchaseState);
    await expect(result).rejects.toThrow('1 of 2 settlements need attention. reservation failed');
    expect(reported).toBe(true);
  });

  it('releases a mixed resumed batch after only its remaining reservation becomes ready', () => {
    expect(
      batchPaymentBarrierState([
        {
          snapshot: {
            registration: { id: 'registration-a', dispatched: true },
            payment: { id: 'payment-a', dispatched: true },
          },
          paymentCost: '900',
        },
        {
          snapshot: { registration: { id: 'registration-b', dispatched: true } },
          paymentCost: '1100',
        },
      ]),
    ).toEqual({
      registrationsReady: 1,
      pendingPaymentCost: 1100n,
    });
  });

  it('requires every fresh reservation and its complete aggregate payment cost', () => {
    expect(
      batchPaymentBarrierState([
        { snapshot: {}, paymentCost: '900' },
        { snapshot: {}, paymentCost: '1100' },
      ]),
    ).toEqual({
      registrationsReady: 0,
      pendingPaymentCost: 2000n,
    });
  });

  it('accepts an explicit replacement leg while rejecting malformed batch recovery', () => {
    expect(isRecoverableBatch(recoveryBatch(), BUYER)).toBe(true);
    expect(isRecoverableBatch({ ...recoveryBatch(), entries: [] }, BUYER)).toBe(false);
    expect(
      isRecoverableBatch(
        {
          ...recoveryBatch(),
          entries: [{ ...recoveryBatch().entries[0], snapshot: {} }],
        },
        BUYER,
      ),
    ).toBe(true);
    expect(
      isRecoverableBatch(
        {
          ...recoveryBatch(),
          entries: [
            {
              ...recoveryBatch().entries[0],
              snapshot: { registration: { id: 'not-a-transaction', dispatched: false } },
            },
          ],
        },
        BUYER,
      ),
    ).toBe(false);
  });

  it('does not let an idle purchase event erase its prepared registration', () => {
    const prepared = recoveryBatch().entries[0].snapshot;
    expect(latestRecoverableSnapshot(prepared, {})).toBe(prepared);
    expect(
      latestRecoverableSnapshot(prepared, {
        registration: { ...prepared.registration! },
      }),
    ).toBe(prepared);
    const dispatched = { registration: { id: REGISTRATION_ID, dispatched: true } };
    expect(latestRecoverableSnapshot(prepared, dispatched)).toEqual(dispatched);
    const dismissed = { ...dispatched, dismissed: true };
    expect(latestRecoverableSnapshot(dispatched, dismissed)).toEqual(dismissed);
  });

  it('keeps complete recovery evidence through partial resumed purchase states', () => {
    const complete = {
      registration: { id: REGISTRATION_ID, dispatched: true },
      payment: { id: PAYMENT_ID, dispatched: true },
      dismissed: true,
    };
    expect(
      latestRecoverableSnapshot(complete, {
        registration: { id: REGISTRATION_ID, dispatched: false },
      }),
    ).toBe(complete);
    expect(
      latestRecoverableSnapshot(complete, {
        registration: { id: REGISTRATION_ID, dispatched: false },
        payment: { id: PAYMENT_ID, dispatched: false },
      }),
    ).toBe(complete);
  });

  it('does not rewrite a 512-lot batch for partial resume projections', () => {
    const complete = Array.from({ length: 512 }, (_, index) => ({
      registration: { id: `${String(index).padStart(42, '0')}R`, dispatched: true },
      payment: { id: `${String(index).padStart(42, '0')}P`, dispatched: true },
    }));
    let writes = 0;
    const resumed = complete.map((snapshot) => {
      const next = latestRecoverableSnapshot(snapshot, {
        registration: { ...snapshot.registration, dispatched: false },
      });
      if (next !== snapshot) writes += 1;
      return next;
    });

    expect(writes).toBe(0);
    expect(resumed.map((snapshot) => snapshot.payment?.id)).toEqual(complete.map((snapshot) => snapshot.payment.id));
  });

  it('coalesces a 512-lot durable update wave and flushes payment-gate ownership synchronously', () => {
    let frame: (() => void) | undefined;
    let schedules = 0;
    let cancels = 0;
    let writes = 0;
    const buffer = batchRecoveryFrameBuffer(
      () => {
        writes += 1;
      },
      (callback) => {
        frame = callback;
        schedules += 1;
        return schedules;
      },
      () => {
        cancels += 1;
      },
    );

    for (let index = 0; index < 1_024; index += 1) buffer.schedule();
    expect({ schedules, writes }).toEqual({ schedules: 1, writes: 0 });
    frame?.();
    expect(writes).toBe(1);

    for (let index = 0; index < 512; index += 1) buffer.schedule();
    buffer.flush();
    expect({ cancels, schedules, writes }).toEqual({ cancels: 1, schedules: 2, writes: 2 });

    buffer.flush(true);
    expect(writes).toBe(3);
    buffer.schedule();
    buffer.clear();
    expect({ cancels, schedules, writes }).toEqual({ cancels: 2, schedules: 3, writes: 3 });
  });

  it('replaces only a deliberately changed purchase leg', () => {
    const complete = {
      registration: { id: REGISTRATION_ID, dispatched: true },
      payment: { id: PAYMENT_ID, dispatched: true },
      dismissed: true,
    };
    const replacementPayment = 'n'.repeat(43);
    expect(
      latestRecoverableSnapshot(complete, {
        registration: { id: REGISTRATION_ID, dispatched: false },
        payment: { id: replacementPayment, dispatched: false },
      }),
    ).toEqual({
      registration: { id: REGISTRATION_ID, dispatched: true },
      payment: { id: replacementPayment, dispatched: false },
      dismissed: true,
    });
    const replacementRegistration = 's'.repeat(43);
    expect(
      latestRecoverableSnapshot(complete, {
        registration: { id: replacementRegistration, dispatched: false },
      }),
    ).toEqual({
      registration: { id: replacementRegistration, dispatched: false },
    });
  });

  it('persists a fully signed batch before honoring a late abort', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    const controller = new AbortController();
    controller.abort(new Error('wallet changed'));

    expect(() =>
      storeBatchRecoveryBeforeDispatch(storage, 'bazar-purchase-batch:asset:buyer', recoveryBatch(), controller.signal),
    ).toThrow('wallet changed');
    expect(JSON.parse(values.get('bazar-purchase-batch:asset:buyer')!)).toMatchObject({
      buyer: BUYER,
      entries: [{ snapshot: { registration: { id: REGISTRATION_ID } } }],
    });
  });

  it('refuses to replace another batch recovery before dispatch', () => {
    const key = 'bazar-purchase-batch:asset:buyer';
    const values = new Map([[key, JSON.stringify({ ...recoveryBatch(), attemptId: 'older-attempt' })]]);
    const storage = {
      getItem: (candidate: string) => values.get(candidate) ?? null,
      setItem: (candidate: string, value: string) => values.set(candidate, value),
    };

    expect(() => storeBatchRecoveryBeforeDispatch(storage, key, recoveryBatch(), new AbortController().signal)).toThrow(
      'wallet-recovery-conflict',
    );
    expect(JSON.parse(values.get(key)!)).toMatchObject({ attemptId: 'older-attempt' });
  });
});

describe('parallel settlement keyboard navigation', () => {
  it('wraps arrow navigation and supports Home and End', () => {
    expect(settlementTabIndex('ArrowRight', 2, 3)).toBe(0);
    expect(settlementTabIndex('ArrowLeft', 0, 3)).toBe(2);
    expect(settlementTabIndex('Home', 2, 3)).toBe(0);
    expect(settlementTabIndex('End', 0, 3)).toBe(2);
  });

  it('ignores unrelated keys and empty tab lists', () => {
    expect(settlementTabIndex('Tab', 0, 3)).toBeNull();
    expect(settlementTabIndex('ArrowRight', 0, 0)).toBeNull();
  });
});

describe('parallel settlement progress summary', () => {
  it('keeps settled, failed, paying, and reserving states mutually exclusive', () => {
    const summary = batchSettlementSummary([
      { stage: 'complete' } as PurchaseState,
      { stage: 'failed' } as PurchaseState,
      { stage: 'payment-confirming' } as PurchaseState,
      { stage: 'registration-confirming' } as PurchaseState,
    ]);
    expect(summary).toMatchObject({ settled: 1, failed: 1, paying: 1, reserving: 1 });
    expect(summary.label).toBe('4 listings · 1 settled · 1 needs attention · 1 paying · 1 reserving');
  });

  it('reports all-failed and not-yet-started batches truthfully', () => {
    expect(
      batchSettlementSummary([{ stage: 'failed' } as PurchaseState, { stage: 'failed' } as PurchaseState]),
    ).toMatchObject({ settled: 0, failed: 2, paying: 0, reserving: 0 });
    expect(batchSettlementSummary([undefined, undefined])).toMatchObject({
      settled: 0,
      failed: 0,
      paying: 0,
      reserving: 2,
    });
  });
});

describe('manual listing keyboard navigation', () => {
  it.each([1, 25, LOT_PICKER_PAGE_SIZE])('keeps %i revealed listings inside one modal tab stop', (count) => {
    const active = Math.floor(count / 2);
    const stops = Array.from({ length: count }, (_, index) => lotOptionTabIndex(index, active));
    expect(stops.filter((tabIndex) => tabIndex === 0)).toHaveLength(1);
    expect(stops[active]).toBe(0);
  });

  it('reaches first, middle, and last revealed listings with conventional listbox keys', () => {
    expect(settlementTabIndex('Home', 25, LOT_PICKER_PAGE_SIZE)).toBe(0);
    expect(settlementTabIndex('ArrowDown', 24, LOT_PICKER_PAGE_SIZE)).toBe(25);
    expect(settlementTabIndex('End', 0, LOT_PICKER_PAGE_SIZE)).toBe(LOT_PICKER_PAGE_SIZE - 1);
  });

  it('reveals large order books in exact bounded batches', () => {
    const orders = Array.from({ length: 10_000 }, (_, index) => ({ orderId: `order-${index}` }));
    expect(visibleLotPickerOrders(orders, new Set(), LOT_PICKER_PAGE_SIZE)).toEqual(orders.slice(0, 50));
    expect(nextLotPickerLimit(50, orders.length)).toBe(100);
    expect(nextLotPickerLimit(9_950, orders.length)).toBe(10_000);
    expect(nextLotPickerLimit(10_000, orders.length)).toBe(10_000);
  });

  it('keeps selected listings first without scanning membership quadratically', () => {
    const reads = { count: 0 };
    const orders = Array.from(
      { length: 10_000 },
      (_, index) =>
        new Proxy(
          { orderId: `order-${index}` },
          {
            get(target, property, receiver) {
              if (property === 'orderId') reads.count += 1;
              return Reflect.get(target, property, receiver);
            },
          },
        ),
    );
    const visible = visibleLotPickerOrders(orders, new Set(['order-9999', 'order-5000']), 50);
    expect(visible.slice(0, 2).map((order) => order.orderId)).toEqual(['order-5000', 'order-9999']);
    expect(reads.count).toBeLessThanOrEqual(orders.length + 2);
  });
});

describe('fungible order action names', () => {
  it('distinguishes each whole-lot action by quantity, total, and seller', () => {
    const state = {
      ticker: 'WEAVE',
      denomination: 12,
    } as AssetState;
    const first = {
      creator: 'A'.repeat(43),
      quantity: '3000000000000',
      asking: '3000000',
    } as SwapOrder;
    const second = {
      creator: 'B'.repeat(43),
      quantity: '5000000000000',
      asking: '6000000',
    } as SwapOrder;

    expect(fungibleOrderActionLabel('buy', first, state)).toBe(`Buy 3 WEAVE for 0.000003 AR from ${'A'.repeat(43)}`);
    expect(fungibleOrderActionLabel('buy', second, state)).toBe(`Buy 5 WEAVE for 0.000006 AR from ${'B'.repeat(43)}`);
    expect(fungibleOrderActionLabel('cancel', first, state)).toBe('Cancel listing of 3 WEAVE for 0.000003 AR');
  });

  it('distinguishes sellers whose compact identities collide', () => {
    const state = { ticker: 'WEAVE', denomination: 12 } as AssetState;
    const shared = { quantity: '3000000000000', asking: '3000000' };
    const first = { ...shared, creator: `AAAAAA${'1'.repeat(32)}AAAAA` } as SwapOrder;
    const second = { ...shared, creator: `AAAAAA${'2'.repeat(32)}AAAAA` } as SwapOrder;

    expect(fungibleListingAccessibleLabel(first, state)).toContain(first.creator);
    expect(fungibleListingAccessibleLabel(second, state)).toContain(second.creator);
    expect(fungibleListingAccessibleLabel(first, state)).not.toBe(fungibleListingAccessibleLabel(second, state));
  });
});

describe('fungible state revalidation', () => {
  it('rejects changed lots and balances before wallet approval', () => {
    const seller = 's'.repeat(43);
    const buyer = 'b'.repeat(43);
    const order = {
      orderId: 'o'.repeat(43),
      creator: seller,
      asking: '2000',
      quantity: '1000',
      status: 'open',
    } as SwapOrder;
    const state = {
      denomination: 12,
      balances: { [seller]: '5000' },
      orders: { [order.orderId]: order },
    } as AssetState;
    expect(fungibleOperationStateError('buy', state, buyer, [order])).toBe('');
    expect(fungibleOperationStateError('buy', { ...state, orders: {} }, buyer, [order])).toBe('market-state-changed');
    expect(fungibleOperationStateError('cancel', state, seller, [order])).toBe('');
    expect(fungibleOperationStateError('cancel', state, buyer, [order])).toBe('market-state-changed');
    expect(fungibleOperationStateError('sell', state, seller, [], '5000')).toBe('');
    expect(fungibleOperationStateError('sell', state, seller, [], '5001')).toBe('market-state-changed');
    expect(fungibleOperationStateError('transfer', state, seller, [], '5000')).toBe('');
    expect(fungibleOperationStateError('transfer', state, seller, [], '5001')).toBe('market-state-changed');
  });
});

describe('fungible transfer recipient validation', () => {
  it('rejects malformed and same-wallet recipients before signing', () => {
    expect(fungibleTransferRecipientError('not-an-address', BUYER)).toContain('43-character');
    expect(fungibleTransferRecipientError(BUYER, BUYER)).toContain('different wallet');
    expect(fungibleTransferRecipientError('c'.repeat(43), BUYER)).toBe('');
    expect(fungibleTransferRecipientError(`  ${'c'.repeat(43)}\n`, BUYER)).toBe('');
  });

  it('names the exact recipient before an irreversible transfer', () => {
    const recipient = 'c'.repeat(43);
    const state = { denomination: 12, ticker: 'WEAVE' } as AssetState;
    expect(fungibleTransferSubmitLabel('2000000000000', state, recipient)).toBe('Send 2 WEAVE to cccccc…ccccc');
    expect(fungibleTransferSubmitLabel('2000000000000', state, recipient, true)).toBe(`Send 2 WEAVE to ${recipient}`);
  });
});

describe('fungible pre-approval language', () => {
  it('does not claim a transaction is signed before the wallet approvals exist', () => {
    expect(fungibleWorkingIntro('sell', 0, false)).toContain('wallet approval');
    expect(fungibleWorkingIntro('sell', 0, false)).toContain('Nothing has been submitted');
    expect(fungibleWorkingIntro('buy', 2, false)).toContain('2 reservations and seller payments');
    expect(fungibleWorkingIntro('buy', 2, false)).not.toContain('settling');
    expect(fungibleWorkingIntro('buy', 2, true)).toContain('settling independently');
  });
});
