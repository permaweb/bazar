import { describe, expect, it } from 'vitest';

import { assetDetailTabIndex } from './AssetDetailTabs';

describe('assetDetailTabIndex', () => {
  it('moves and wraps with arrow keys', () => {
    expect(assetDetailTabIndex('ArrowRight', 2, 3)).toBe(0);
    expect(assetDetailTabIndex('ArrowLeft', 0, 3)).toBe(2);
    expect(assetDetailTabIndex('ArrowDown', 0, 3)).toBe(1);
  });

  it('supports boundary keys and ignores unrelated keys', () => {
    expect(assetDetailTabIndex('Home', 2, 4)).toBe(0);
    expect(assetDetailTabIndex('End', 0, 4)).toBe(3);
    expect(assetDetailTabIndex('Enter', 0, 4)).toBeNull();
  });
});
