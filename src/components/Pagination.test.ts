import { describe, expect, it } from 'vitest';

import { paginationItems } from './Pagination';

describe('paginationItems', () => {
  it('keeps large page lists compact around the current page', () => {
    expect(paginationItems(1, 23)).toEqual(['1', '2', '3', '4', 'ellipsis-4', '23']);
    expect(paginationItems(12, 23)).toEqual(['1', 'ellipsis-1', '11', '12', '13', 'ellipsis-13', '23']);
    expect(paginationItems(23, 23)).toEqual(['1', 'ellipsis-1', '20', '21', '22', '23']);
  });
});
