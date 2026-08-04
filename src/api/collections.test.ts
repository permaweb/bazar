import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadCollections, loadMoreCarrierNames, type Collection } from './collections';

const firstAsset = 'A'.repeat(43);
const secondAsset = 'B'.repeat(43);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('carrier name pagination', () => {
  it('reads the total from the initial page', async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      if (!String(input).endsWith('/graphql')) return new Response('', { status: 404 });
      return jsonResponse({
        data: {
          transactions: {
            count: '16654',
            pageInfo: { hasNextPage: true },
            edges: [carrierEdge('first-cursor', firstAsset, 'zebra')],
          },
        },
      });
    });
    vi.stubGlobal('fetch', fetcher);

    const [names] = await loadCollections();
    const graphqlCall = fetcher.mock.calls.find(([input]) => String(input).endsWith('/graphql'));
    const body = JSON.parse(String(graphqlCall?.[1]?.body));

    expect(body.query).toMatch(/\bcount\b/);
    expect(body.variables.after).toBeNull();
    expect(names).toMatchObject({
      id: 'arweave-names',
      total: 16654,
      cursor: 'first-cursor',
      hasMore: true,
      assets: [{ id: firstAsset, name: 'zebra' }],
    });
  });

  it('omits count after the first page and preserves the initial total', async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({
        data: {
          transactions: {
            pageInfo: { hasNextPage: true },
            edges: [carrierEdge('second-cursor', secondAsset, 'yellow')],
          },
        },
      }),
    );
    vi.stubGlobal('fetch', fetcher);
    const collection: Collection = {
      id: 'arweave-names',
      name: 'Arweave names',
      description: '16,654 carrier names owned and traded directly on Arweave.',
      kind: 'names',
      assets: [{ id: firstAsset, name: 'zebra' }],
      total: 16654,
      cursor: 'first-cursor',
      hasMore: true,
    };

    const updated = await loadMoreCarrierNames(collection);
    const body = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body));

    expect(body.query).not.toMatch(/\bcount\b/);
    expect(body.variables.after).toBe('first-cursor');
    expect(updated).toMatchObject({
      total: 16654,
      cursor: 'second-cursor',
      hasMore: true,
      assets: [
        { id: firstAsset, name: 'zebra' },
        { id: secondAsset, name: 'yellow' },
      ],
    });
  });
});

function carrierEdge(cursor: string, id: string, name: string) {
  return {
    cursor,
    node: {
      id,
      tags: [
        { name: 'execution-device', value: 'carrier@1.0' },
        { name: 'name', value: name },
      ],
    },
  };
}

function jsonResponse(value: unknown) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}
