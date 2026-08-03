import type { AssetSummary } from 'api/collections';
import type { SwapOrder } from 'api/asset-marketplace';
import type { PurchaseSnapshot } from 'weave-wrangler';

export const OPERATION_ACTIVITY_STORAGE_KEY = 'bazar-operation-activities:v1';

export type Operation =
  | { kind: 'sell' | 'transfer'; resumeId?: string; value?: string }
  | { kind: 'cancel'; order: SwapOrder; resumeId?: string }
  | { kind: 'buy'; order: SwapOrder; resume?: PurchaseSnapshot };

export type OperationActivityPhase = 'form' | 'working' | 'done' | 'error';

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
  const durable = activities.filter((activity) => activity.phase === 'working' || activity.phase === 'error');
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
    const saved = parseJson<StoredPurchase>(storage.getItem(`bazar-purchase:${activity.asset.id}`));
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
    return { ...activity, phase: 'working', status: 'Restarting purchase safely…' };
  }

  const saved = parseJson<StoredOperation>(storage.getItem(`bazar-operation:${activity.asset.id}`));
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
  return value === 'form' || value === 'working' || value === 'done' || value === 'error';
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
