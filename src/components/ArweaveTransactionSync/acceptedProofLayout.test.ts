import { describe, expect, it } from 'vitest';

import { acceptedProofCardPosition, connectorEndpoint } from './TransactionSequenceCable3D';

describe('accepted proof layout', () => {
  it('keeps a single block card close to its marker', () => {
    expect(acceptedProofCardPosition(0, 1, 320, 80, 700, 320, 240, 116)).toEqual({ x: 332, y: 92 });
    expect(acceptedProofCardPosition(0, 1, 620, 240, 700, 320, 240, 116)).toEqual({ x: 368, y: 112 });
  });

  it('keeps a nearby block card within the visualization edges', () => {
    expect(acceptedProofCardPosition(0, 1, 4, 4, 320, 160, 196, 128)).toEqual({ x: 16, y: 16 });
    expect(acceptedProofCardPosition(0, 1, 316, 156, 320, 160, 196, 128)).toEqual({ x: 108, y: 16 });
  });

  it('ends the connector at the visible card border', () => {
    const endpoint = connectorEndpoint(320, 160, 456, 4, 240, 116);

    expect(endpoint.x).toBe(456);
    expect(endpoint.y).toBeCloseTo(107.94, 2);
  });
});
