import { describe, expect, it } from 'vitest';

import { acceptedProofCardPosition, connectorEndpoint } from './TransactionSequenceCable3D';

describe('accepted proof layout', () => {
  it('places a single block card on the right edge and opposite its marker', () => {
    expect(acceptedProofCardPosition(0, 1, 80, 700, 320, 240, 116)).toEqual({ x: 456, y: 200 });
    expect(acceptedProofCardPosition(0, 1, 240, 700, 320, 240, 116)).toEqual({ x: 456, y: 4 });
  });

  it('ends the connector at the visible card border', () => {
    const endpoint = connectorEndpoint(320, 160, 456, 4, 240, 116);

    expect(endpoint.x).toBe(456);
    expect(endpoint.y).toBeCloseTo(107.94, 2);
  });
});
