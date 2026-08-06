import { describe, expect, it } from 'vitest';

import { observerVerificationDelayed, quorumConfirmationDepth } from './confirmationDepth';

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

  it('distinguishes unavailable observer verification from zero confirmations', () => {
    expect(
      observerVerificationDelayed({
        transaction: {
          consensus: { confirmations: 0, answering: 0, eligible: 0 },
          views: [{ ...observer('limited.example', 0), state: 'pending', httpStatus: 429, lastSeenAt: 2 }],
        },
      }),
    ).toBe(true);
    expect(
      observerVerificationDelayed({
        transaction: {
          consensus: { confirmations: 0, answering: 2, eligible: 5 },
          views: [{ ...observer('healthy.example', 0), state: 'pending', httpStatus: 404, lastSeenAt: 2 }],
        },
      }),
    ).toBe(false);
    expect(
      observerVerificationDelayed({
        transaction: {
          consensus: { confirmations: 0, answering: 0, eligible: 0 },
          views: [],
        },
      }),
    ).toBe(false);
  });
});
