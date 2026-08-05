import { describe, expect, it } from 'vitest';

import { marketActivityLabel } from './MarketActivityList';

describe('market activity labels', () => {
  it('presents a purchase reservation as a submitted purchase', () => {
    expect(marketActivityLabel('register-interest')).toBe('Purchase submitted');
  });
});
