import { describe, expect, it } from 'vitest';

import {
  discardNewlyPreparedTransactionIfAborted,
  acquireWalletOperationClaim,
  assertWalletOperationAvailable,
  atomicPurchaseStorageKey,
  clearStaleWalletOperationClaim,
  hasRecoverablePurchase,
  isWalletOperationStorageKey,
  latestPurchaseSnapshot,
  loadWalletRecord,
  operationForSigner,
  operationClaimStorageKey,
  operationStorageKey,
  purchaseRecoveryApprovalCount,
  removeWalletRecordIf,
  releaseWalletOperationClaim,
  promoteWalletOperationClaim,
  repairRejectedPurchase,
  removeSignedTransactionRecords,
  removeCompletedPurchaseRecoveryAndSignatures,
  removeWalletRecoveryAndSignatures,
  storeWalletRecordIf,
  storeWalletRecordOrThrow,
  shouldAutomaticallyResumePurchase,
  walletOperationStorageChange,
} from './operation-session';

const REGISTRATION_ID = 'r'.repeat(43);
const PAYMENT_ID = 'p'.repeat(43);

describe('wallet-bound operation sessions', () => {
  it('exposes an operation only to the signer that opened it', () => {
    const session = { signer: 'wallet-a', operation: { kind: 'sell' } };

    expect(operationForSigner(session, 'wallet-a')).toEqual({ kind: 'sell' });
    expect(operationForSigner(session, 'wallet-b')).toBeNull();
    expect(operationForSigner(session, undefined)).toBeNull();
  });

  it('does not expose an absent operation', () => {
    expect(operationForSigner(null, 'wallet-a')).toBeNull();
  });

  it('gives each signer independent recovery keys', () => {
    expect(operationStorageKey('asset', 'wallet-a')).not.toBe(operationStorageKey('asset', 'wallet-b'));
    expect(atomicPurchaseStorageKey('asset', 'wallet-a')).not.toBe(atomicPurchaseStorageKey('asset', 'wallet-b'));
  });

  it('gives purchases and balance-changing asset actions independent claims', () => {
    expect(operationClaimStorageKey('asset', 'wallet-a', 'purchase')).toBe(
      'bazar-operation-claim:asset:wallet-a:purchase',
    );
    expect(operationClaimStorageKey('asset', 'wallet-a', 'asset')).toBe('bazar-operation-claim:asset:wallet-a:asset');
  });

  it('holds a purchase claim and an asset-action claim at the same time', async () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    };
    const held = new Set<string>();
    const locks = {
      async request<T>(name: string, _options: unknown, callback: (lock: unknown | null) => T | PromiseLike<T>) {
        if (held.has(name)) return await callback(null);
        held.add(name);
        try {
          return await callback({});
        } finally {
          held.delete(name);
        }
      },
    };
    const purchase = await acquireWalletOperationClaim(
      storage,
      operationClaimStorageKey('asset', 'wallet-a', 'purchase'),
      [atomicPurchaseStorageKey('asset', 'wallet-a')],
      { locks },
    );
    const assetAction = await acquireWalletOperationClaim(
      storage,
      operationClaimStorageKey('asset', 'wallet-a', 'asset'),
      [operationStorageKey('asset', 'wallet-a')],
      { locks },
    );

    expect(values.has(purchase.key)).toBe(true);
    expect(values.has(assetAction.key)).toBe(true);
    releaseWalletOperationClaim(storage, purchase);
    releaseWalletOperationClaim(storage, assetAction);
  });

  it('requires a signed transaction before describing a purchase as recoverable', () => {
    expect(hasRecoverablePurchase()).toBe(false);
    expect(hasRecoverablePurchase({})).toBe(false);
    expect(hasRecoverablePurchase({ registration: {} })).toBe(false);
    expect(hasRecoverablePurchase({ registration: { id: 'registration' } })).toBe(false);
    expect(hasRecoverablePurchase({ payment: { id: PAYMENT_ID } })).toBe(false);
    expect(hasRecoverablePurchase({ registration: { id: REGISTRATION_ID, dispatched: false } })).toBe(true);
    expect(
      hasRecoverablePurchase({
        registration: { id: REGISTRATION_ID, dispatched: false },
        payment: { id: PAYMENT_ID, dispatched: false },
      }),
    ).toBe(true);
    expect(
      hasRecoverablePurchase({
        registration: { id: REGISTRATION_ID, dispatched: true },
        payment: { id: PAYMENT_ID, dispatched: false },
      }),
    ).toBe(true);
  });

  it('requires an explicit action before recovery can request any new wallet approval', () => {
    expect(purchaseRecoveryApprovalCount()).toBe(2);
    expect(purchaseRecoveryApprovalCount({})).toBe(2);
    expect(purchaseRecoveryApprovalCount({ registration: { id: 'invalid', dispatched: true } })).toBe(2);
    expect(purchaseRecoveryApprovalCount({ payment: { id: 'invalid', dispatched: false } })).toBe(2);
    expect(purchaseRecoveryApprovalCount({ registration: { id: REGISTRATION_ID, dispatched: true } })).toBe(1);
    expect(
      purchaseRecoveryApprovalCount({
        registration: { id: REGISTRATION_ID, dispatched: true },
        payment: { id: PAYMENT_ID, dispatched: false },
      }),
    ).toBe(0);
    expect(shouldAutomaticallyResumePurchase({ registration: { id: REGISTRATION_ID, dispatched: true } })).toBe(false);
    expect(shouldAutomaticallyResumePurchase({ payment: { id: PAYMENT_ID, dispatched: false } })).toBe(false);
    expect(
      shouldAutomaticallyResumePurchase({
        registration: { id: REGISTRATION_ID, dispatched: true },
        payment: { id: PAYMENT_ID, dispatched: false },
      }),
    ).toBe(true);
  });

  it('repairs only the terminally rejected purchase leg', () => {
    const unsignedPair = {
      registration: { id: REGISTRATION_ID, dispatched: false },
      payment: { id: PAYMENT_ID, dispatched: false },
    };
    expect(repairRejectedPurchase(unsignedPair, 'registration-dispatch-rejected')).toEqual({
      discardIds: [REGISTRATION_ID, PAYMENT_ID],
      snapshot: null,
    });
    expect(
      repairRejectedPurchase(
        {
          registration: { id: REGISTRATION_ID, dispatched: true },
          payment: { id: PAYMENT_ID, dispatched: false },
        },
        'payment-dispatch-rejected',
      ),
    ).toEqual({
      discardIds: [PAYMENT_ID],
      snapshot: { registration: { id: REGISTRATION_ID, dispatched: true } },
    });
    expect(repairRejectedPurchase(unsignedPair, 'registration-dispatch-failed')).toEqual({
      discardIds: [],
      snapshot: unsignedPair,
    });
  });

  it('resumes from the newest repaired purchase snapshot', () => {
    const original = {
      registration: { id: REGISTRATION_ID, dispatched: true },
      payment: { id: PAYMENT_ID, dispatched: false },
    };
    const repaired = repairRejectedPurchase(original, 'payment-dispatch-rejected').snapshot;

    expect(latestPurchaseSnapshot(original, repaired)).toEqual({
      registration: { id: REGISTRATION_ID, dispatched: true },
    });
    expect(latestPurchaseSnapshot(original, null)).toBe(original);
  });

  it('removes only exact signed transaction records after live-state success', () => {
    const removed: string[] = [];

    removeSignedTransactionRecords({ removeItem: (key) => removed.push(key) }, [
      REGISTRATION_ID,
      PAYMENT_ID,
      REGISTRATION_ID,
      'invalid',
      undefined,
    ]);

    expect(removed).toEqual([`bazar-signed-transaction:${REGISTRATION_ID}`, `bazar-signed-transaction:${PAYMENT_ID}`]);
  });

  it('retains signed material when a newer recovery record owns the storage key', () => {
    const key = operationStorageKey('asset', 'wallet-a');
    const registrationKey = `bazar-signed-transaction:${REGISTRATION_ID}`;
    const values = new Map<string, string>([
      [key, JSON.stringify({ attemptId: 'newer' })],
      [registrationKey, JSON.stringify({ transaction: { id: REGISTRATION_ID } })],
    ]);
    const storage = {
      getItem: (candidate: string) => values.get(candidate) ?? null,
      removeItem: (candidate: string) => values.delete(candidate),
    };

    expect(
      removeWalletRecoveryAndSignatures<{ attemptId: string }>(storage, key, (record) => record.attemptId === 'older', [
        REGISTRATION_ID,
      ]),
    ).toBe(false);
    expect(values.has(key)).toBe(true);
    expect(values.has(registrationKey)).toBe(true);

    expect(
      removeWalletRecoveryAndSignatures<{ attemptId: string }>(storage, key, (record) => record.attemptId === 'newer', [
        REGISTRATION_ID,
      ]),
    ).toBe(true);
    expect(values.has(key)).toBe(false);
    expect(values.has(registrationKey)).toBe(false);
  });

  it('retains exact signed payment evidence while a purchase is blocked', () => {
    const recoveryKey = atomicPurchaseStorageKey('asset', 'wallet-a');
    const registrationKey = `bazar-signed-transaction:${REGISTRATION_ID}`;
    const paymentKey = `bazar-signed-transaction:${PAYMENT_ID}`;
    const values = new Map<string, string>([
      [recoveryKey, JSON.stringify({ buyer: 'wallet-a' })],
      [registrationKey, JSON.stringify({ transaction: { id: REGISTRATION_ID } })],
      [paymentKey, JSON.stringify({ transaction: { id: PAYMENT_ID } })],
    ]);
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      removeItem: (key: string) => values.delete(key),
    };

    expect(
      removeCompletedPurchaseRecoveryAndSignatures<{ buyer: string }>(
        'blocked',
        storage,
        recoveryKey,
        (record) => record.buyer === 'wallet-a',
        [REGISTRATION_ID, PAYMENT_ID],
      ),
    ).toBe(false);
    expect([...values.keys()]).toEqual([recoveryKey, registrationKey, paymentKey]);
  });

  it('removes a signed transaction only for its exact expected signer', () => {
    const key = `bazar-signed-transaction:${REGISTRATION_ID}`;
    const values = new Map([
      [
        key,
        JSON.stringify({
          expectedSigner: 'wallet-a',
          transaction: { id: REGISTRATION_ID },
        }),
      ],
    ]);
    const storage = {
      getItem: (candidate: string) => values.get(candidate) ?? null,
      removeItem: (candidate: string) => values.delete(candidate),
    };

    removeSignedTransactionRecords(storage, [REGISTRATION_ID], 'wallet-b');
    expect(values.has(key)).toBe(true);
    removeSignedTransactionRecords(storage, [REGISTRATION_ID], 'wallet-a');
    expect(values.has(key)).toBe(false);
  });

  it('discards only newly prepared signatures when abort wins before recovery promotion', () => {
    const removed: string[] = [];
    const storage = { removeItem: (key: string) => removed.push(key) };
    const active = new AbortController();
    const aborted = new AbortController();
    aborted.abort();

    expect(discardNewlyPreparedTransactionIfAborted(storage, REGISTRATION_ID, true, active.signal)).toBe(false);
    expect(discardNewlyPreparedTransactionIfAborted(storage, REGISTRATION_ID, false, aborted.signal)).toBe(true);
    expect(removed).toEqual([]);
    expect(discardNewlyPreparedTransactionIfAborted(storage, REGISTRATION_ID, true, aborted.signal)).toBe(true);
    expect(removed).toEqual([`bazar-signed-transaction:${REGISTRATION_ID}`]);
  });

  it('migrates only a matching legacy recovery record', () => {
    const values = new Map<string, string>([
      ['bazar-operation:asset', JSON.stringify({ signer: 'wallet-a', txId: 'transaction' })],
    ]);
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    };

    expect(
      loadWalletRecord<{ signer: string; txId: string }>(
        storage,
        operationStorageKey('asset', 'wallet-b'),
        'bazar-operation:asset',
        (record) => record.signer === 'wallet-b',
      ),
    ).toBeNull();
    expect(values.has('bazar-operation:asset')).toBe(true);

    expect(
      loadWalletRecord<{ signer: string; txId: string }>(
        storage,
        operationStorageKey('asset', 'wallet-a'),
        'bazar-operation:asset',
        (record) => record.signer === 'wallet-a',
      ),
    ).toEqual({ signer: 'wallet-a', txId: 'transaction' });
    expect(values.has('bazar-operation:asset')).toBe(false);
    expect(values.has(operationStorageKey('asset', 'wallet-a'))).toBe(true);
  });

  it('removes an invalid record only from the signer-scoped key', () => {
    const scoped = operationStorageKey('asset', 'wallet-b');
    const legacy = 'bazar-operation:asset';
    const values = new Map<string, string>([
      [scoped, JSON.stringify({ signer: 'wallet-a' })],
      [legacy, JSON.stringify({ signer: 'wallet-a' })],
    ]);
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    };

    expect(
      loadWalletRecord<{ signer: string }>(storage, scoped, legacy, (record) => record.signer === 'wallet-b'),
    ).toBeNull();
    expect(values.has(scoped)).toBe(false);
    expect(values.has(legacy)).toBe(true);
  });

  it('removes only the exact attempt that finished', () => {
    const key = operationStorageKey('asset', 'wallet-a');
    const values = new Map([[key, JSON.stringify({ txId: 'newer-transaction' })]]);
    const storage = {
      getItem: (candidate: string) => values.get(candidate) ?? null,
      removeItem: (candidate: string) => values.delete(candidate),
    };

    expect(removeWalletRecordIf<{ txId: string }>(storage, key, (record) => record.txId === 'older-transaction')).toBe(
      false,
    );
    expect(values.has(key)).toBe(true);
    expect(removeWalletRecordIf<{ txId: string }>(storage, key, (record) => record.txId === 'newer-transaction')).toBe(
      true,
    );
    expect(values.has(key)).toBe(false);
  });

  it('does not let an older attempt overwrite newer recovery', () => {
    const key = operationStorageKey('asset', 'wallet-a');
    const values = new Map([[key, JSON.stringify({ txId: 'newer-transaction', stage: 1 })]]);
    const storage = {
      getItem: (candidate: string) => values.get(candidate) ?? null,
      setItem: (candidate: string, value: string) => values.set(candidate, value),
    };

    expect(
      storeWalletRecordIf(
        storage,
        key,
        { txId: 'older-transaction', stage: 2 },
        (record) => record.txId === 'older-transaction',
      ),
    ).toBe(false);
    expect(JSON.parse(values.get(key)!)).toEqual({ txId: 'newer-transaction', stage: 1 });
    expect(
      storeWalletRecordIf(
        storage,
        key,
        { txId: 'newer-transaction', stage: 2 },
        (record) => record.txId === 'newer-transaction',
      ),
    ).toBe(true);
    expect(JSON.parse(values.get(key)!)).toEqual({ txId: 'newer-transaction', stage: 2 });
  });

  it('turns a lost recovery claim into a hard pre-dispatch failure', () => {
    const key = operationStorageKey('asset', 'wallet-a');
    const values = new Map([[key, JSON.stringify({ txId: 'pending-transaction' })]]);
    const storage = {
      getItem: (candidate: string) => values.get(candidate) ?? null,
      setItem: (candidate: string, value: string) => values.set(candidate, value),
    };

    expect(() =>
      storeWalletRecordOrThrow(
        storage,
        key,
        { txId: 'new-transaction' },
        (record) => record.txId === 'new-transaction',
        true,
      ),
    ).toThrow('wallet-recovery-conflict');
    expect(JSON.parse(values.get(key)!)).toEqual({ txId: 'pending-transaction' });
  });

  it('blocks a second document before it requests another signature', () => {
    const operationKey = operationStorageKey('asset', 'wallet-a');
    const purchaseKey = atomicPurchaseStorageKey('asset', 'wallet-a');
    const values = new Map([[operationKey, JSON.stringify({ txId: 'pending-transaction' })]]);
    let signatures = 0;
    const sign = () => {
      signatures += 1;
    };

    expect(() => {
      assertWalletOperationAvailable({ getItem: (key) => values.get(key) ?? null }, [operationKey, purchaseKey]);
      sign();
    }).toThrow('wallet-recovery-conflict');
    expect(signatures).toBe(0);
  });

  it('holds one cross-document claim across deferred wallet approval', async () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    };
    let held = false;
    const locks = {
      async request<T>(_name: string, _options: unknown, callback: (lock: unknown | null) => T | PromiseLike<T>) {
        if (held) return await callback(null);
        held = true;
        try {
          return await callback({});
        } finally {
          held = false;
        }
      },
    };
    const claimKey = operationClaimStorageKey('asset', 'wallet-a');
    const operationKey = operationStorageKey('asset', 'wallet-a');
    const purchaseKey = atomicPurchaseStorageKey('asset', 'wallet-a');
    let signatures = 0;
    const begin = async () => {
      const claim = await acquireWalletOperationClaim(storage, claimKey, [operationKey, purchaseKey], { locks });
      signatures += 1;
      return claim;
    };
    const first = await begin();
    await expect(begin()).rejects.toThrow('wallet-recovery-conflict');
    expect(signatures).toBe(1);

    promoteWalletOperationClaim(
      storage,
      first,
      operationKey,
      { txId: 'signed-transaction' },
      (record) => record.txId === 'signed-transaction',
    );
    expect(values.has(claimKey)).toBe(true);
    expect(JSON.parse(values.get(operationKey)!)).toEqual({ txId: 'signed-transaction' });
    await expect(
      acquireWalletOperationClaim(storage, claimKey, [operationKey, purchaseKey], {
        locks,
        recovery: {
          key: operationKey,
          matches: (record: any) => record?.txId === 'signed-transaction',
        },
      }),
    ).rejects.toThrow('wallet-recovery-conflict');
    releaseWalletOperationClaim(storage, first);
    expect(values.has(claimKey)).toBe(false);
    while (held) await new Promise((resolve) => setTimeout(resolve, 0));
    const resumed = await acquireWalletOperationClaim(storage, claimKey, [operationKey, purchaseKey], {
      locks,
      recovery: {
        key: operationKey,
        matches: (record: any) => record?.txId === 'signed-transaction',
      },
    });
    expect(values.has(claimKey)).toBe(true);
    releaseWalletOperationClaim(storage, resumed);
  });

  it('fails closed when cross-document locking is unavailable', async () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    };
    const claimKey = operationClaimStorageKey('asset', 'wallet-a');
    await expect(acquireWalletOperationClaim(storage, claimKey, [], { locks: null })).rejects.toThrow(
      'wallet-operation-lock-unavailable',
    );
    expect(values.has(claimKey)).toBe(false);
  });

  it('waits for a crashed owner to release its lock, then clears the stale claim', async () => {
    const claimKey = operationClaimStorageKey('asset', 'wallet-a');
    const values = new Map([[claimKey, JSON.stringify({ attemptId: 'crashed' })]]);
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      removeItem: (key: string) => values.delete(key),
    };
    let grantLock!: () => void;
    const queuedLocks = {
      request: <T>(_name: string, _options: unknown, callback: (lock: unknown | null) => T | PromiseLike<T>) =>
        new Promise<T>((resolve, reject) => {
          grantLock = () => {
            void Promise.resolve(callback({})).then(resolve, reject);
          };
        }),
    };

    let settled = false;
    const clearing = clearStaleWalletOperationClaim(storage, claimKey, { locks: queuedLocks }).finally(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(values.has(claimKey)).toBe(true);
    grantLock();
    await expect(clearing).resolves.toBe(true);
    expect(values.has(claimKey)).toBe(false);
  });

  it('scopes cross-document storage events to the active asset and signer', () => {
    const keys = [operationStorageKey('asset', 'wallet-a'), atomicPurchaseStorageKey('asset', 'wallet-a')];

    expect(isWalletOperationStorageKey(keys[0], keys)).toBe(true);
    expect(isWalletOperationStorageKey(keys[1], keys)).toBe(true);
    expect(isWalletOperationStorageKey(operationStorageKey('asset', 'wallet-b'), keys)).toBe(false);
    expect(isWalletOperationStorageKey(operationStorageKey('other', 'wallet-a'), keys)).toBe(false);
    expect(isWalletOperationStorageKey(null, keys)).toBe(false);
  });

  it('distinguishes claim release from deliberate recovery removal', () => {
    const claimKey = operationClaimStorageKey('asset', 'wallet-a');
    const recoveryKeys = [operationStorageKey('asset', 'wallet-a'), atomicPurchaseStorageKey('asset', 'wallet-a')];

    expect(walletOperationStorageChange(claimKey, '{}', claimKey, recoveryKeys)).toBe('claim-acquired');
    expect(walletOperationStorageChange(claimKey, null, claimKey, recoveryKeys)).toBe('claim-released');
    expect(walletOperationStorageChange(recoveryKeys[0], '{}', claimKey, recoveryKeys)).toBe('recovery-updated');
    expect(walletOperationStorageChange(recoveryKeys[1], null, claimKey, recoveryKeys)).toBe('recovery-removed');
    expect(walletOperationStorageChange(operationStorageKey('asset', 'wallet-b'), null, claimKey, recoveryKeys)).toBe(
      'ignore',
    );
  });
});
