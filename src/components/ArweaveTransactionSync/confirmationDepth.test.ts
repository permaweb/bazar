import { describe, expect, it } from 'vitest';

import { quorumConfirmationDepth } from './confirmationDepth';

const observer = (node: string, confirmations: number, blockId?: string) => ({
  observer: { url: `https://${node}`, label: node, source: 'peer' as const, failures: 0 },
  state: 'confirmed' as const,
  confirmations,
  blockId,
  updatedAt: 1,
  changedAt: 1,
});

describe('quorumConfirmationDepth', () => {
  it('never treats a single deep observer as quorum progress', () => {
    expect(
      quorumConfirmationDepth({
        transaction: {
          views: [observer('one.example', 5, 'block-a'), { ...observer('two.example', 0), state: 'pending' }],
        },
      }),
    ).toBe(0);
  });

  it('never combines raw observer depths from conflicting blocks', () => {
    expect(
      quorumConfirmationDepth({
        transaction: {
          views: [observer('one.example', 5, 'block-a'), observer('two.example', 5, 'block-b')],
        },
      }),
    ).toBe(0);
  });

  it('uses only an explicit or watcher-consensus confirmation depth', () => {
    expect(quorumConfirmationDepth({ confirmations: 5 })).toBe(5);
    expect(quorumConfirmationDepth({ transaction: { consensus: { confirmations: 3 } } })).toBe(3);
  });
});
