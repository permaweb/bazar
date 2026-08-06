import type { PurchaseSnapshot } from 'weave-wrangler';

export const WALLET_OPERATION_RECOVERY_CHANGE_EVENT = 'bazar:wallet-operation-recovery-changed';

export type OperationSession<T> = {
  signer: string;
  operation: T;
};

export type WalletOperationClaim = {
  key: string;
  attemptId: string;
  releaseLock(): void;
};

export type WalletOperationStorageChange =
  'claim-acquired' | 'claim-released' | 'recovery-updated' | 'recovery-removed' | 'ignore';

type LockManagerLike = {
  request<T>(
    name: string,
    options: { mode: 'exclusive'; ifAvailable?: true; signal?: AbortSignal },
    callback: (lock: unknown | null) => T | PromiseLike<T>,
  ): Promise<T>;
};

export type WalletOperationClaimOptions = {
  locks?: LockManagerLike | null;
  recovery?: {
    key: string;
    matches(record: unknown): boolean;
  };
};

export function operationForSigner<T>(session: OperationSession<T> | null, signer?: string | null) {
  return session && session.signer === signer ? session.operation : null;
}

export function atomicPurchaseStorageKey(assetId: string, buyer: string) {
  return `bazar-purchase:${assetId}:${buyer}`;
}

export function fungibleBatchStorageKey(assetId: string, buyer: string) {
  return `bazar-purchase-batch:${assetId}:${buyer}`;
}

export function isWalletOperationRecoveryKey(key: string | null) {
  return Boolean(
    key?.startsWith('bazar-operation:') ||
    key?.startsWith('bazar-purchase:') ||
    key?.startsWith('bazar-purchase-batch:'),
  );
}

export function hasRecoverablePurchase(
  snapshot?: {
    registration?: { id?: string; dispatched?: boolean };
    payment?: { id?: string; dispatched?: boolean };
  } | null,
) {
  const registration = snapshot?.registration;
  if (!registration || !/^[A-Za-z0-9_-]{43}$/.test(registration.id ?? '')) return false;
  if (!snapshot?.payment) return true;
  return /^[A-Za-z0-9_-]{43}$/.test(snapshot.payment.id ?? '');
}

export function purchaseRecoveryApprovalCount(snapshot?: PurchaseSnapshot | null) {
  if (/^[A-Za-z0-9_-]{43}$/.test(snapshot?.payment?.id ?? '')) return 0;
  if (/^[A-Za-z0-9_-]{43}$/.test(snapshot?.registration?.id ?? '')) return 1;
  return 2;
}

export function shouldAutomaticallyResumePurchase(snapshot?: PurchaseSnapshot | null) {
  return hasRecoverablePurchase(snapshot) && purchaseRecoveryApprovalCount(snapshot) === 0;
}

export function latestPurchaseSnapshot(
  resume: PurchaseSnapshot | null | undefined,
  current: PurchaseSnapshot | null | undefined,
) {
  return current ?? resume ?? null;
}

export function repairRejectedPurchase(
  snapshot: PurchaseSnapshot,
  code: string | undefined,
): { discardIds: string[]; snapshot: PurchaseSnapshot | null } {
  if (
    code === 'registration-dispatch-rejected' ||
    code === 'asset-order-reservation-rejected' ||
    code === 'asset-order-reservation-expired'
  ) {
    return {
      discardIds: [snapshot.registration?.id, snapshot.payment?.id].filter((id): id is string => Boolean(id)),
      snapshot: null,
    };
  }
  if (code === 'payment-dispatch-rejected' && snapshot.registration?.dispatched) {
    return {
      discardIds: snapshot.payment?.id ? [snapshot.payment.id] : [],
      snapshot: { registration: snapshot.registration },
    };
  }
  return { discardIds: [], snapshot };
}

export function removeSignedTransactionRecords(
  storage: Pick<Storage, 'removeItem'> & Partial<Pick<Storage, 'getItem'>>,
  ids: Array<string | null | undefined>,
  expectedSigner?: string,
) {
  for (const id of new Set(ids)) {
    if (/^[A-Za-z0-9_-]{43}$/.test(id ?? '')) {
      if (expectedSigner) {
        const held = storage.getItem?.(`bazar-signed-transaction:${id}`);
        if (!held) continue;
        try {
          const stored = JSON.parse(held) as { expectedSigner?: string; transaction?: { id?: string } };
          if (stored.expectedSigner !== expectedSigner || stored.transaction?.id !== id) continue;
        } catch {
          continue;
        }
      }
      storage.removeItem(`bazar-signed-transaction:${id}`);
    }
  }
}

export function removeWalletRecoveryAndSignatures<T>(
  storage: Pick<Storage, 'getItem' | 'removeItem'>,
  key: string,
  matches: (record: T) => boolean,
  ids: Array<string | null | undefined>,
  expectedSigner?: string,
) {
  if (!removeWalletRecordIf(storage, key, matches)) return false;
  removeSignedTransactionRecords(storage, ids, expectedSigner);
  return true;
}

export function removeCompletedPurchaseRecoveryAndSignatures<T>(
  status: 'complete' | 'resumable' | 'blocked',
  storage: Pick<Storage, 'getItem' | 'removeItem'>,
  key: string,
  matches: (record: T) => boolean,
  ids: Array<string | null | undefined>,
  expectedSigner?: string,
) {
  return status === 'complete' && removeWalletRecoveryAndSignatures(storage, key, matches, ids, expectedSigner);
}

export function discardNewlyPreparedTransactionIfAborted(
  storage: Pick<Storage, 'removeItem'>,
  id: string,
  newlyPrepared: boolean,
  signal: AbortSignal,
) {
  if (!signal.aborted) return false;
  if (newlyPrepared && /^[A-Za-z0-9_-]{43}$/.test(id)) {
    storage.removeItem(`bazar-signed-transaction:${id}`);
  }
  return true;
}

export function operationStorageKey(assetId: string, signer: string) {
  return `bazar-operation:${assetId}:${signer}`;
}

export function operationClaimStorageKey(assetId: string, signer: string, scope?: string) {
  return `bazar-operation-claim:${assetId}:${signer}${scope ? `:${scope}` : ''}`;
}

export function isWalletOperationStorageKey(key: string | null, keys: string[]) {
  return key !== null && keys.includes(key);
}

export function walletOperationStorageChange(
  key: string | null,
  newValue: string | null,
  claimKey: string,
  recoveryKeys: string[],
): WalletOperationStorageChange {
  if (key === claimKey) return newValue === null ? 'claim-released' : 'claim-acquired';
  if (!isWalletOperationStorageKey(key, recoveryKeys)) return 'ignore';
  return newValue === null ? 'recovery-removed' : 'recovery-updated';
}

export function assertWalletOperationAvailable(storage: Pick<Storage, 'getItem'>, keys: string[]) {
  if (keys.some((key) => storage.getItem(key) !== null)) {
    throw new Error('wallet-recovery-conflict');
  }
}

export async function acquireWalletOperationClaim(
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
  claimKey: string,
  recoveryKeys: string[],
  options: WalletOperationClaimOptions = {},
): Promise<WalletOperationClaim> {
  const locks =
    options.locks === undefined ? (typeof navigator === 'undefined' ? undefined : navigator.locks) : options.locks;
  const attemptId = globalThis.crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  const writeClaim = (releaseLock: () => void, clearStale = false): WalletOperationClaim => {
    if (clearStale && storage.getItem(claimKey) !== null) storage.removeItem(claimKey);
    assertWalletOperationAvailable(storage, [claimKey, ...recoveryKeys.filter((key) => key !== options.recovery?.key)]);
    if (options.recovery) {
      let recovered: unknown;
      try {
        recovered = JSON.parse(storage.getItem(options.recovery.key) ?? 'null');
      } catch {
        throw new Error('wallet-recovery-conflict');
      }
      try {
        if (!options.recovery.matches(recovered)) throw new Error('wallet-recovery-conflict');
      } catch {
        throw new Error('wallet-recovery-conflict');
      }
    }
    storage.setItem(claimKey, JSON.stringify({ attemptId, createdAt: Date.now() }));
    try {
      if ((JSON.parse(storage.getItem(claimKey) ?? 'null') as { attemptId?: string } | null)?.attemptId !== attemptId) {
        throw new Error('wallet-recovery-conflict');
      }
    } catch {
      throw new Error('wallet-recovery-conflict');
    }
    return { key: claimKey, attemptId, releaseLock };
  };

  if (!locks) throw new Error('wallet-operation-lock-unavailable');
  let releaseHeldLock!: () => void;
  let resolveAcquired!: (claim: WalletOperationClaim) => void;
  let rejectAcquired!: (cause: unknown) => void;
  const acquired = new Promise<WalletOperationClaim>((resolve, reject) => {
    resolveAcquired = resolve;
    rejectAcquired = reject;
  });
  void locks
    .request(claimKey, { mode: 'exclusive', ifAvailable: true }, async (lock) => {
      if (!lock) {
        rejectAcquired(new Error('wallet-recovery-conflict'));
        return;
      }
      let release!: () => void;
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      releaseHeldLock = release;
      try {
        resolveAcquired(writeClaim(release, true));
        await held;
      } catch (cause) {
        rejectAcquired(cause);
      }
    })
    .catch(rejectAcquired);
  try {
    return await acquired;
  } catch (cause) {
    releaseHeldLock?.();
    throw cause;
  }
}

export function releaseWalletOperationClaim(
  storage: Pick<Storage, 'getItem' | 'removeItem'>,
  claim: WalletOperationClaim,
) {
  removeWalletRecordIf<{ attemptId?: string }>(storage, claim.key, (record) => record.attemptId === claim.attemptId);
  claim.releaseLock();
}

export async function clearStaleWalletOperationClaim(
  storage: Pick<Storage, 'getItem' | 'removeItem'>,
  claimKey: string,
  options: { locks?: LockManagerLike | null; signal?: AbortSignal } = {},
) {
  const locks =
    options.locks === undefined ? (typeof navigator === 'undefined' ? undefined : navigator.locks) : options.locks;
  if (!locks || storage.getItem(claimKey) === null) return false;
  return locks.request(
    claimKey,
    {
      mode: 'exclusive',
      ...(options.signal ? { signal: options.signal } : {}),
    },
    (lock) => {
      if (!lock || storage.getItem(claimKey) === null) return false;
      storage.removeItem(claimKey);
      return true;
    },
  );
}

export function promoteWalletOperationClaim<T>(
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
  claim: WalletOperationClaim,
  recoveryKey: string,
  record: T,
  matches: (current: T) => boolean,
) {
  let held: { attemptId?: string } | null = null;
  try {
    held = JSON.parse(storage.getItem(claim.key) ?? 'null') as { attemptId?: string } | null;
  } catch {
    throw new Error('wallet-recovery-conflict');
  }
  if (held?.attemptId !== claim.attemptId) throw new Error('wallet-recovery-conflict');
  storeWalletRecordOrThrow(storage, recoveryKey, record, matches, true);
}

export function loadWalletRecord<T>(
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
  key: string,
  legacyKey: string,
  matches: (record: T) => boolean,
): T | null {
  const current = storage.getItem(key);
  if (current) {
    try {
      const record = JSON.parse(current) as T;
      if (matches(record)) return record;
    } catch {
      // Invalid recovery cannot remain authoritative merely because it exists.
    }
    removeWalletRecord(storage, key);
    return null;
  }
  const legacy = storage.getItem(legacyKey);
  if (!legacy) return null;
  try {
    const record = JSON.parse(legacy) as T;
    if (!matches(record)) return null;
    storage.setItem(key, legacy);
    storage.removeItem(legacyKey);
    notifyWalletOperationRecoveryChange(storage, key);
    return record;
  } catch {
    return null;
  }
}

export function removeWalletRecord(storage: Pick<Storage, 'getItem' | 'removeItem'>, key: string) {
  if (storage.getItem(key) === null) return false;
  storage.removeItem(key);
  notifyWalletOperationRecoveryChange(storage, key);
  return true;
}

export function removeWalletRecordIf<T>(
  storage: Pick<Storage, 'getItem' | 'removeItem'>,
  key: string,
  matches: (record: T) => boolean,
) {
  const current = storage.getItem(key);
  if (!current) return false;
  try {
    if (!matches(JSON.parse(current) as T)) return false;
    storage.removeItem(key);
    notifyWalletOperationRecoveryChange(storage, key);
    return true;
  } catch {
    return false;
  }
}

export function storeWalletRecordIf<T>(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  key: string,
  record: T,
  matches: (current: T) => boolean,
  allowMissing = false,
) {
  const current = storage.getItem(key);
  if (!current) {
    if (!allowMissing) return false;
    storage.setItem(key, JSON.stringify(record));
    notifyWalletOperationRecoveryChange(storage, key);
    return true;
  }
  try {
    if (!matches(JSON.parse(current) as T)) return false;
    storage.setItem(key, JSON.stringify(record));
    // The owning dialog already publishes live phase updates. Existing-record
    // writes do not change durable activity membership in this document.
    return true;
  } catch {
    return false;
  }
}

function notifyWalletOperationRecoveryChange(storage: object, key: string) {
  if (
    !isWalletOperationRecoveryKey(key) ||
    typeof window === 'undefined' ||
    typeof localStorage === 'undefined' ||
    storage !== localStorage
  )
    return;
  window.dispatchEvent(new CustomEvent(WALLET_OPERATION_RECOVERY_CHANGE_EVENT, { detail: key }));
}

export function storeWalletRecordOrThrow<T>(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  key: string,
  record: T,
  matches: (current: T) => boolean,
  allowMissing = false,
) {
  if (!storeWalletRecordIf(storage, key, record, matches, allowMissing)) {
    throw new Error('wallet-recovery-conflict');
  }
}
