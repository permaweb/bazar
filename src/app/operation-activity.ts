import type { AssetSummary, Collection } from 'api/collections';
import type { SwapOrder } from 'api/asset-marketplace';
import type { PurchaseSnapshot } from 'weave-wrangler';
import { atomicPurchaseStorageKey, fungibleBatchStorageKey, operationStorageKey } from './operation-session';

export const OPERATION_ACTIVITY_STORAGE_KEY = 'bazar-operation-activities:v1';
export const FUNGIBLE_OPERATION_ACTIVITY_STORAGE_KEY = 'bazar-fungible-operation-activities:v1';
export const FUNGIBLE_OPERATION_ACTIVITY_CHANGE_EVENT = 'bazar:fungible-operation-activities-changed';
export const FUNGIBLE_OPERATION_ACTIVITY_SHOW_EVENT = 'bazar:show-fungible-operation-activity';

export type Operation =
  | { kind: 'sell'; resumeId?: string; value?: string }
  | { kind: 'transfer'; resumeId?: string; startingSlot?: number; value?: string }
  | { kind: 'cancel'; order: SwapOrder; resumeId?: string; startingSlot?: number }
  | { kind: 'buy'; order: SwapOrder; resume?: PurchaseSnapshot };

export type OperationActivityPhase = 'form' | 'approval' | 'working' | 'done' | 'error';

export type OperationActivity = {
  id: string;
  asset: AssetSummary;
  collectionId: string;
  owner: string;
  operation: Operation;
  phase: OperationActivityPhase;
  status: string;
  confirmations: number;
  confirmationTarget: number;
  createdAt: number;
};

type ActivityStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

type EnumerableActivityStorage = ActivityStorage & Pick<Storage, 'key' | 'length'>;

export type FungibleOperationKind = 'sell' | 'transfer' | 'cancel' | 'buy';

export type FungibleOperationActivitySummary = {
  id: string;
  asset: AssetSummary;
  collectionId: string;
  owner: string;
  operationKind: FungibleOperationKind;
  phase: OperationActivityPhase;
  status: string;
  createdAt: number;
};

type StoredPurchase = {
  buyer?: unknown;
  order?: unknown;
  snapshot?: unknown;
};

type StoredOperation = {
  signer?: unknown;
  txId?: unknown;
  kind?: unknown;
  order?: unknown;
  value?: unknown;
};

export function loadOperationActivities(storage: ActivityStorage, owner: string): OperationActivity[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(storage.getItem(OPERATION_ACTIVITY_STORAGE_KEY) ?? 'null');
  } catch {
    storage.removeItem(OPERATION_ACTIVITY_STORAGE_KEY);
    return [];
  }
  if (!isRecord(parsed) || parsed.version !== 1 || !Array.isArray(parsed.activities)) return [];

  const activities: OperationActivity[] = [];
  for (const candidate of parsed.activities) {
    const activity = parseActivity(candidate);
    if (!activity || activity.owner !== owner || activity.phase === 'done') continue;
    activities.push(reconcileActivity(activity, storage));
  }
  return activities.sort((left, right) => right.createdAt - left.createdAt);
}

export function saveOperationActivities(
  storage: ActivityStorage,
  activities: OperationActivity[],
  managedOwners: string[],
): void {
  const durable = activities.filter(
    (activity) => activity.phase === 'approval' || activity.phase === 'working' || activity.phase === 'error',
  );
  const preserved = readStoredActivities(storage).filter((activity) => !managedOwners.includes(activity.owner));
  const stored = [...durable, ...preserved];
  if (!stored.length) {
    storage.removeItem(OPERATION_ACTIVITY_STORAGE_KEY);
    return;
  }
  storage.setItem(OPERATION_ACTIVITY_STORAGE_KEY, JSON.stringify({ version: 1, activities: stored }));
}

function readStoredActivities(storage: ActivityStorage): OperationActivity[] {
  try {
    const parsed = JSON.parse(storage.getItem(OPERATION_ACTIVITY_STORAGE_KEY) ?? 'null');
    if (!isRecord(parsed) || parsed.version !== 1 || !Array.isArray(parsed.activities)) return [];
    return parsed.activities.map(parseActivity).filter((activity): activity is OperationActivity => Boolean(activity));
  } catch {
    return [];
  }
}

function reconcileActivity(activity: OperationActivity, storage: ActivityStorage): OperationActivity {
  if (activity.operation.kind === 'buy') {
    const saved = parseJson<StoredPurchase>(
      storage.getItem(atomicPurchaseStorageKey(activity.asset.id, activity.owner)),
    );
    if (saved?.buyer === activity.owner && isRecord(saved.order)) {
      return {
        ...activity,
        operation: {
          kind: 'buy',
          order: saved.order as unknown as SwapOrder,
          ...(isRecord(saved.snapshot) ? { resume: saved.snapshot as PurchaseSnapshot } : {}),
        },
        phase: 'working',
        status: 'Resuming purchase…',
      };
    }
    return { ...activity, phase: 'working', status: 'Reviewing interrupted purchase…' };
  }

  const saved = parseJson<StoredOperation>(storage.getItem(operationStorageKey(activity.asset.id, activity.owner)));
  if (saved?.signer === activity.owner && typeof saved.txId === 'string' && saved.kind === activity.operation.kind) {
    const operation =
      saved.kind === 'cancel' && isRecord(saved.order)
        ? ({ kind: 'cancel', order: saved.order as unknown as SwapOrder, resumeId: saved.txId } as const)
        : ({
            kind: saved.kind as 'sell' | 'transfer',
            resumeId: saved.txId,
            ...(typeof saved.value === 'string' ? { value: saved.value } : {}),
          } as const);
    return { ...activity, operation, phase: 'working', status: 'Resuming signed transaction…' };
  }

  if ('resumeId' in activity.operation && activity.operation.resumeId) {
    return { ...activity, phase: 'working', status: 'Resuming signed transaction…' };
  }
  return {
    ...activity,
    phase: 'form',
    status: 'Signing was interrupted. Review and sign again.',
    confirmations: 0,
  };
}

function parseActivity(value: unknown): OperationActivity | null {
  if (!isRecord(value) || !isRecord(value.asset) || !isOperation(value.operation)) return null;
  if (
    typeof value.id !== 'string' ||
    typeof value.asset.id !== 'string' ||
    typeof value.asset.name !== 'string' ||
    typeof value.collectionId !== 'string' ||
    typeof value.owner !== 'string' ||
    !isPhase(value.phase) ||
    typeof value.status !== 'string' ||
    typeof value.createdAt !== 'number'
  )
    return null;
  return {
    id: value.id,
    asset: value.asset as unknown as AssetSummary,
    collectionId: value.collectionId,
    owner: value.owner,
    operation: value.operation,
    phase: value.phase,
    status: value.status,
    confirmations: finiteNonNegative(value.confirmations),
    confirmationTarget: Math.max(1, finiteNonNegative(value.confirmationTarget) || 5),
    createdAt: value.createdAt,
  };
}

function isOperation(value: unknown): value is Operation {
  if (!isRecord(value)) return false;
  if (value.kind === 'sell' || value.kind === 'transfer') {
    return value.resumeId === undefined || typeof value.resumeId === 'string';
  }
  if (value.kind === 'cancel') return isRecord(value.order) && typeof value.order.orderId === 'string';
  return value.kind === 'buy' && isRecord(value.order) && typeof value.order.orderId === 'string';
}

function isPhase(value: unknown): value is OperationActivityPhase {
  return value === 'form' || value === 'approval' || value === 'working' || value === 'done' || value === 'error';
}

export function fungibleOperationActivityId(assetId: string, owner: string, operationKind: FungibleOperationKind) {
  return `fungible:${assetId}:${owner}:${operationKind === 'buy' ? 'purchase' : 'asset'}`;
}

export function loadFungibleOperationActivities(
  storage: ActivityStorage,
  owner: string,
  options: { durableOnly?: boolean } = {},
): FungibleOperationActivitySummary[] {
  const activities = readStoredFungibleActivities(storage).filter(
    (activity) => activity.owner === owner && activity.phase !== 'done',
  );
  const restored = options.durableOnly
    ? activities.filter((activity) => fungibleActivityHasRecovery(storage, activity))
    : activities;
  if (options.durableOnly && restored.length !== activities.length) {
    saveFungibleOperationActivities(storage, restored, [owner]);
  }
  return restored.sort((left, right) => right.createdAt - left.createdAt);
}

export function saveFungibleOperationActivities(
  storage: ActivityStorage,
  activities: FungibleOperationActivitySummary[],
  managedOwners: string[],
) {
  const preserved = readStoredFungibleActivities(storage).filter((activity) => !managedOwners.includes(activity.owner));
  const stored = [...activities.filter((activity) => activity.phase !== 'done'), ...preserved];
  if (!stored.length) {
    storage.removeItem(FUNGIBLE_OPERATION_ACTIVITY_STORAGE_KEY);
    return;
  }
  storage.setItem(FUNGIBLE_OPERATION_ACTIVITY_STORAGE_KEY, JSON.stringify({ version: 1, activities: stored }));
}

export function upsertFungibleOperationActivity(storage: ActivityStorage, activity: FungibleOperationActivitySummary) {
  const current = readStoredFungibleActivities(storage);
  saveFungibleOperationActivities(
    storage,
    [activity, ...current.filter((candidate) => candidate.id !== activity.id && candidate.owner === activity.owner)],
    [activity.owner],
  );
}

export function removeFungibleOperationActivity(storage: ActivityStorage, id: string, owner: string) {
  saveFungibleOperationActivities(
    storage,
    readStoredFungibleActivities(storage).filter((activity) => activity.owner === owner && activity.id !== id),
    [owner],
  );
}

export function discoverFungibleOperationActivities(
  storage: EnumerableActivityStorage,
  owner: string,
  collections: Collection[],
): FungibleOperationActivitySummary[] {
  const discovered: FungibleOperationActivitySummary[] = [];
  const operationSuffix = `:${owner}`;
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key?.endsWith(operationSuffix)) continue;
    const purchase = key.startsWith('bazar-purchase-batch:');
    const operation = key.startsWith('bazar-operation:');
    if (!purchase && !operation) continue;
    const assetId = key.slice(
      purchase ? 'bazar-purchase-batch:'.length : 'bazar-operation:'.length,
      -operationSuffix.length,
    );
    const located = locateAsset(collections, assetId);
    if (!located) continue;
    const record = parseJson<Record<string, unknown>>(storage.getItem(key));
    if (!record || (purchase ? record.buyer !== owner : record.signer !== owner)) continue;
    const operationKind = purchase ? 'buy' : parseFungibleOperationKind(record.kind);
    if (!operationKind) continue;
    discovered.push({
      id: fungibleOperationActivityId(assetId, owner, operationKind),
      asset: located.asset,
      collectionId: located.collection.id,
      owner,
      operationKind,
      phase: 'working',
      status: purchase ? 'Resume saved purchase' : 'Resume signed transaction',
      createdAt: typeof record.createdAt === 'number' ? record.createdAt : Date.now(),
    });
  }
  return discovered.sort((left, right) => right.createdAt - left.createdAt);
}

function readStoredFungibleActivities(storage: ActivityStorage): FungibleOperationActivitySummary[] {
  try {
    const parsed = JSON.parse(storage.getItem(FUNGIBLE_OPERATION_ACTIVITY_STORAGE_KEY) ?? 'null');
    if (!isRecord(parsed) || parsed.version !== 1 || !Array.isArray(parsed.activities)) return [];
    return parsed.activities
      .map(parseFungibleActivity)
      .filter((activity): activity is FungibleOperationActivitySummary => Boolean(activity));
  } catch {
    storage.removeItem(FUNGIBLE_OPERATION_ACTIVITY_STORAGE_KEY);
    return [];
  }
}

function parseFungibleActivity(value: unknown): FungibleOperationActivitySummary | null {
  if (!isRecord(value) || !isRecord(value.asset)) return null;
  const operationKind = parseFungibleOperationKind(value.operationKind);
  if (
    typeof value.id !== 'string' ||
    typeof value.asset.id !== 'string' ||
    typeof value.asset.name !== 'string' ||
    typeof value.collectionId !== 'string' ||
    typeof value.owner !== 'string' ||
    !operationKind ||
    !isPhase(value.phase) ||
    typeof value.status !== 'string' ||
    typeof value.createdAt !== 'number'
  )
    return null;
  return {
    id: value.id,
    asset: value.asset as unknown as AssetSummary,
    collectionId: value.collectionId,
    owner: value.owner,
    operationKind,
    phase: value.phase,
    status: value.status,
    createdAt: value.createdAt,
  };
}

function fungibleActivityHasRecovery(storage: ActivityStorage, activity: FungibleOperationActivitySummary) {
  const key =
    activity.operationKind === 'buy'
      ? fungibleBatchStorageKey(activity.asset.id, activity.owner)
      : operationStorageKey(activity.asset.id, activity.owner);
  return storage.getItem(key) !== null;
}

function parseFungibleOperationKind(value: unknown): FungibleOperationKind | null {
  return value === 'sell' || value === 'transfer' || value === 'cancel' || value === 'buy' ? value : null;
}

function locateAsset(collections: Collection[], assetId: string) {
  for (const collection of collections) {
    const asset = collection.assets.find((candidate) => candidate.id === assetId);
    if (asset) return { asset, collection };
  }
  return null;
}

function finiteNonNegative(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
}

function parseJson<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
