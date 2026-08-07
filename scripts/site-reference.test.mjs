import { describe, expect, it } from 'vitest';

import { initialReferenceTags, nextReferenceTimestamp, setReferenceTags, tagsToObject } from './site-reference-lib.mjs';

const authority = 'a'.repeat(43);
const referenceId = 'b'.repeat(43);
const target = 'c'.repeat(43);

describe('site reference items', () => {
  it('creates an authority-owned reference definition', () => {
    expect(tagsToObject(initialReferenceTags({ authority, target, timestamp: 1000 }))).toEqual({
      device: 'reference@1.0',
      authority,
      timestamp: '1000',
      'reference-value': target,
    });
  });

  it('creates a set that targets the stable reference id', () => {
    expect(tagsToObject(setReferenceTags({ referenceId, target, timestamp: 1001 }))).toEqual({
      device: 'reference@1.0',
      'reference-id': referenceId,
      timestamp: '1001',
      'reference-value': target,
    });
  });

  it('always advances beyond known local or indexed timestamps', () => {
    expect(nextReferenceTimestamp(1000, 900, 1200)).toBe(1201);
    expect(nextReferenceTimestamp(1300, 900, 1200)).toBe(1300);
    expect(nextReferenceTimestamp(1300, 1200, 0)).toBe(1300);
  });
});
