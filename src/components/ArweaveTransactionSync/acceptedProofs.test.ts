import type { ArweaveAcceptedProof } from 'api/arweave-mining-telemetry';
import { describe, expect, it } from 'vitest';

import { insertAcceptedProof, upsertAcceptedProof } from './acceptedProofs';

describe('accepted block annotations', () => {
  it('inserts a raw block proof immediately without replacing later enrichment', () => {
    const raw = proof(1);
    const enriched = {
      ...raw,
      recallSamples: [
        { index: 1, offset: 10, content: { contentUrl: 'https://10b.arweave.net/', kind: 'text' as const } },
      ],
    };
    expect(insertAcceptedProof([], raw)).toEqual([raw]);
    expect(insertAcceptedProof([enriched], raw)).toEqual([enriched]);
  });

  it('hydrates an existing annotation and retains the ten newest blocks', () => {
    const raw = proof(11);
    const enriched = { ...raw, miningAddress: 'miner' };
    const current = Array.from({ length: 10 }, (_, index) => proof(index + 1));
    const updated = upsertAcceptedProof([...current, raw], enriched);
    expect(updated).toHaveLength(10);
    expect(updated[0].height).toBe(2);
    expect(updated.at(-1)).toEqual(enriched);
  });
});

function proof(height: number): ArweaveAcceptedProof {
  return {
    key: `${height}:block-${height}`,
    height,
    blockId: `block-${height}`,
    proofCount: 1,
    recallBytes: [height * 10],
    recallSamples: [{ index: 1, offset: height * 10 }],
    transactionCount: 0,
    observedAt: height * 1_000,
  };
}
