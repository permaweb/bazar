import { describe, expect, it } from 'vitest';
import type { SwapOrder } from 'api/asset-marketplace';

import {
  OPERATION_ACTIVITY_STORAGE_KEY,
  loadOperationActivities,
  saveOperationActivities,
  type OperationActivity,
} from './operation-activity';

const owner = 'A'.repeat(43);
const otherOwner = 'B'.repeat(43);

class MemoryStorage {
  readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

function activity(overrides: Partial<OperationActivity> = {}): OperationActivity {
  return {
    id: 'activity-1',
    asset: { id: 'asset-1', name: 'Permanent Strata #001', image: 'https://arweave.net/image' },
    collectionId: 'collection-1',
    owner,
    operation: { kind: 'sell', value: '0.5' },
    phase: 'working',
    status: 'Watching Arweave confirmations…',
    confirmations: 0,
    confirmationTarget: 5,
    createdAt: 100,
    ...overrides,
  };
}

describe('operation activity persistence', () => {
  it('persists recoverable work while omitting forms and completed entries', () => {
    const storage = new MemoryStorage();
    saveOperationActivities(
      storage,
      [
        activity(),
        activity({ id: 'form', phase: 'form' }),
        activity({ id: 'done', phase: 'done' }),
        activity({ id: 'error', phase: 'error' }),
      ],
      [owner],
    );

    const stored = JSON.parse(storage.getItem(OPERATION_ACTIVITY_STORAGE_KEY) ?? '{}');
    expect(stored.activities.map((item: OperationActivity) => item.id)).toEqual(['activity-1', 'error']);
  });

  it('preserves another wallet activity when replacing the current wallet records', () => {
    const storage = new MemoryStorage();
    saveOperationActivities(storage, [activity({ id: 'other', owner: otherOwner })], [otherOwner]);
    saveOperationActivities(storage, [activity()], [owner]);

    expect(loadOperationActivities(storage, otherOwner).map((item) => item.id)).toEqual(['other']);
    expect(loadOperationActivities(storage, owner).map((item) => item.id)).toEqual(['activity-1']);
  });

  it('rehydrates the signed transaction id before restarting a marketplace action', () => {
    const storage = new MemoryStorage();
    saveOperationActivities(storage, [activity()], [owner]);
    storage.setItem(
      'bazar-operation:asset-1',
      JSON.stringify({ signer: owner, txId: 'T'.repeat(43), kind: 'sell', value: '0.5' }),
    );

    const [restored] = loadOperationActivities(storage, owner);
    expect(restored.operation).toEqual({ kind: 'sell', resumeId: 'T'.repeat(43), value: '0.5' });
    expect(restored.status).toBe('Resuming signed transaction…');
  });

  it('uses the latest purchase snapshot instead of restarting the purchase from scratch', () => {
    const storage = new MemoryStorage();
    const order = { orderId: 'O'.repeat(43) } as SwapOrder;
    saveOperationActivities(
      storage,
      [activity({ operation: { kind: 'buy', order }, status: 'Reserving asset…' })],
      [owner],
    );
    const snapshot = { registration: { id: 'R'.repeat(43), dispatched: true } };
    storage.setItem('bazar-purchase:asset-1', JSON.stringify({ buyer: owner, order, snapshot }));

    const [restored] = loadOperationActivities(storage, owner);
    expect(restored.operation).toEqual({ kind: 'buy', order, resume: snapshot });
    expect(restored.status).toBe('Resuming purchase…');
  });

  it('turns an interrupted pre-sign action back into a reviewable form', () => {
    const storage = new MemoryStorage();
    saveOperationActivities(storage, [activity()], [owner]);

    const [restored] = loadOperationActivities(storage, owner);
    expect(restored.phase).toBe('form');
    expect(restored.status).toContain('Signing was interrupted');
  });

  it('drops corrupt registry data without throwing', () => {
    const storage = new MemoryStorage();
    storage.setItem(OPERATION_ACTIVITY_STORAGE_KEY, '{not-json');

    expect(loadOperationActivities(storage, owner)).toEqual([]);
    expect(storage.getItem(OPERATION_ACTIVITY_STORAGE_KEY)).toBeNull();
  });
});
