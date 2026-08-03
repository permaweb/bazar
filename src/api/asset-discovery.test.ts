import { describe, expect, it, vi } from 'vitest';

import type { Collection } from './collections';
import {
  discoverWalletAssetCandidates,
  discoverCollectionActivity,
  discoverMarketActivity,
  discoverMarketActivityPage,
  isLiveListing,
  resolveAssetCandidates,
  restrictAssetCandidates,
  walletAssetGroup,
  type AssetCandidate,
} from './asset-discovery';
import { parseAssetState } from './asset-marketplace';

const wallet = 'W'.repeat(43);
const buyer = 'B'.repeat(43);
const assetA = 'A'.repeat(43);
const assetB = 'C'.repeat(43);
const assetC = 'D'.repeat(43);
const orderId = 'O'.repeat(43);

const collections: Collection[] = [
  {
    id: 'images',
    name: '[TEST] Images',
    description: 'Test',
    kind: 'images',
    assets: [
      { id: assetA, name: 'Asset A', image: `https://arweave.net/${assetA}` },
      { id: assetB, name: 'Asset B', image: `https://arweave.net/${assetB}` },
      { id: assetC, name: 'Asset C', image: `https://arweave.net/${assetC}` },
    ],
  },
  {
    id: 'arweave-names',
    name: 'Arweave names',
    description: 'Names',
    kind: 'names',
    assets: [],
  },
];

describe('wallet candidate discovery', () => {
  it('uses one aliased query per page, deduplicates targets, and keeps newest activity first', async () => {
    const pages = [
      {
        data: {
          initiallyHeld: {
            pageInfo: { hasNextPage: true },
            edges: [
              {
                cursor: 'initial-1',
                node: {
                  id: assetA,
                  tags: [{ name: 'initial-holder', value: wallet }],
                  block: { height: 10, timestamp: 100 },
                },
              },
            ],
          },
          marketActions: {
            pageInfo: { hasNextPage: false },
            edges: [
              {
                cursor: 'market-1',
                node: {
                  id: 'M'.repeat(43),
                  recipient: assetA,
                  owner: { address: wallet },
                  tags: [{ name: 'action', value: 'make-offer' }],
                  block: { height: 30, timestamp: 300 },
                },
              },
            ],
          },
          receivedTransfers: {
            pageInfo: { hasNextPage: false },
            edges: [
              {
                cursor: 'transfer-1',
                node: {
                  id: 'T'.repeat(43),
                  recipient: assetB,
                  tags: [
                    { name: 'action', value: 'transfer' },
                    { name: 'recipient', value: wallet },
                  ],
                  block: { height: 20, timestamp: 200 },
                },
              },
            ],
          },
        },
      },
      {
        data: {
          initiallyHeld: {
            pageInfo: { hasNextPage: false },
            edges: [
              {
                cursor: 'initial-2',
                node: {
                  id: assetC,
                  tags: [{ name: 'initial-holder', value: wallet }],
                  block: { height: 5, timestamp: 50 },
                },
              },
            ],
          },
        },
      },
    ];
    const fetcher = vi.fn(
      async () =>
        new Response(JSON.stringify(pages.shift()), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );

    const candidates = await discoverWalletAssetCandidates(wallet, { fetch: fetcher as typeof fetch });

    expect(fetcher).toHaveBeenCalledTimes(2);
    const firstCall = fetcher.mock.calls[0] as unknown as [RequestInfo | URL, RequestInit];
    const firstBody = JSON.parse(String(firstCall[1].body));
    expect(firstBody.query).toContain('initiallyHeld: transactions');
    expect(firstBody.query).toContain('marketActions: transactions');
    expect(firstBody.query).toContain('receivedTransfers: transactions');
    expect(firstBody.variables.marketTags[0].values).toEqual(['register-interest', 'make-offer']);
    expect(firstBody.variables.transferTags).toContainEqual({ name: 'recipient', values: [wallet] });
    expect(candidates.map((candidate) => candidate.processId)).toEqual([assetA, assetB, assetC]);
    expect(candidates[0]).toMatchObject({
      height: 30,
      sources: ['initial-holder', 'market-action'],
    });
  });

  it('scopes collection activity by recipients and can query listings only', async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            data: {
              transactions: {
                pageInfo: { hasNextPage: false },
                edges: [],
              },
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    );

    await discoverMarketActivity({
      fetch: fetcher as typeof fetch,
      recipients: [assetA, assetB],
      listingsOnly: true,
    });

    const call = fetcher.mock.calls[0] as unknown as [RequestInfo | URL, RequestInit];
    const body = JSON.parse(String(call[1].body));
    expect(body.query).toContain('recipients: $recipients');
    expect(body.variables.recipients).toEqual([assetA, assetB]);
    expect(body.variables.tags).toEqual([{ name: 'action', values: ['make-offer'] }]);
  });

  it('returns one bounded market page, deduplicates targets, and exposes the next cursor', async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            data: {
              transactions: {
                pageInfo: { hasNextPage: true },
                edges: [
                  {
                    cursor: 'offer-1',
                    node: {
                      id: 'E'.repeat(43),
                      recipient: assetA,
                      tags: [{ name: 'action', value: 'make-offer' }],
                      block: { height: 10, timestamp: 100 },
                    },
                  },
                  {
                    cursor: 'offer-2',
                    node: {
                      id: 'F'.repeat(43),
                      recipient: assetA,
                      tags: [{ name: 'action', value: 'make-offer' }],
                      block: { height: 12, timestamp: 120 },
                    },
                  },
                  {
                    cursor: 'offer-3',
                    node: {
                      id: 'G'.repeat(43),
                      recipient: assetB,
                      tags: [{ name: 'action', value: 'make-offer' }],
                      block: { height: 11, timestamp: 110 },
                    },
                  },
                ],
              },
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    );

    const page = await discoverMarketActivityPage({
      cursor: 'previous-page',
      fetch: fetcher as typeof fetch,
      listingsOnly: true,
      pageSize: 12,
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    const call = fetcher.mock.calls[0] as unknown as [RequestInfo | URL, RequestInit];
    const body = JSON.parse(String(call[1].body));
    expect(body.variables).toMatchObject({ cursor: 'previous-page', first: 12 });
    expect(page).toMatchObject({ cursor: 'offer-3', hasMore: true });
    expect(page.candidates.map((candidate) => [candidate.processId, candidate.height])).toEqual([
      [assetA, 12],
      [assetB, 11],
    ]);
  });

  it('returns bounded collection activity events with their actors and targets', async () => {
    const transaction = 'T'.repeat(43);
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            data: {
              transactions: {
                pageInfo: { hasNextPage: false },
                edges: [
                  {
                    cursor: 'activity-1',
                    node: {
                      id: transaction,
                      recipient: assetA,
                      owner: { address: wallet },
                      tags: [{ name: 'action', value: 'transfer' }],
                      block: { height: 42, timestamp: 420 },
                    },
                  },
                ],
              },
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    );

    const events = await discoverCollectionActivity({
      fetch: fetcher as typeof fetch,
      recipients: [assetA, assetA, 'invalid'],
      limit: 20,
    });

    expect(events).toEqual([
      {
        id: transaction,
        processId: assetA,
        action: 'transfer',
        actor: wallet,
        height: 42,
        timestamp: 420,
      },
    ]);
    const call = fetcher.mock.calls[0] as unknown as [RequestInfo | URL, RequestInit];
    const body = JSON.parse(String(call[1].body));
    expect(body.variables.recipients).toEqual([assetA]);
  });
});

describe('live candidate resolution', () => {
  it('bounds live computation and excludes unsupported assets', async () => {
    let active = 0;
    let peak = 0;
    const candidates: AssetCandidate[] = [assetA, assetB, assetC].map((processId, index) => ({
      processId,
      height: 30 - index,
      timestamp: 0,
      sources: ['initial-holder'],
    }));
    const results = await resolveAssetCandidates(candidates, collections, {
      concurrency: 2,
      read: async (processId) => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active -= 1;
        return {
          provider: 'https://compute.example',
          state: parseAssetState({
            'execution-device': processId === assetC ? 'carrier@1.0' : 'token@1.0',
            name: processId === assetC ? 'A carrier' : '',
            'total-supply': 1,
            balances: { [wallet]: '1' },
            orders: {},
          }),
        };
      },
    });

    expect(peak).toBe(2);
    expect(results.map((result) => result.asset.id)).toEqual([assetA, assetB]);
  });

  it('uses immutable creation tags to avoid computing unsupported initial holdings', () => {
    const candidates: AssetCandidate[] = [
      {
        processId: assetA,
        height: 3,
        timestamp: 0,
        sources: ['initial-holder'],
        device: 'token@1.0',
        collection: '[TEST] Images',
      },
      {
        processId: 'U'.repeat(43),
        height: 2,
        timestamp: 0,
        sources: ['initial-holder'],
        device: 'token@1.0',
        collection: '[TEST] Unknown',
      },
      {
        processId: assetB,
        height: 1,
        timestamp: 0,
        sources: ['transfer'],
      },
    ];

    expect(restrictAssetCandidates(candidates, collections).map((candidate) => candidate.processId)).toEqual([
      assetA,
      assetB,
    ]);
  });

  it('accepts and resolves Bazar-created token assets outside a published collection index', async () => {
    const minted = 'Z'.repeat(43);
    const media = 'I'.repeat(43);
    const candidate: AssetCandidate = {
      processId: minted,
      height: 4,
      timestamp: 1,
      sources: ['initial-holder'],
      device: 'token@1.0',
      collection: 'Created on Bazar',
      bazarMint: true,
    };

    expect(restrictAssetCandidates([candidate], collections)).toEqual([candidate]);
    const resolved = await resolveAssetCandidates([candidate], collections, {
      read: async () => ({
        provider: 'https://compute.example',
        state: parseAssetState({
          'execution-device': 'token@1.0',
          'total-supply': 1,
          balances: { [wallet]: '1' },
          orders: {},
          name: 'Minted signal',
          'asset-data': media,
          'asset-content-type': 'image/png',
        }),
      }),
    });

    expect(resolved[0]).toMatchObject({
      asset: { id: minted, name: 'Minted signal', image: `https://arweave.net/${media}` },
      collection: { id: 'created-assets', name: 'Created on Bazar' },
    });
  });

  it('groups only current live ownership and active listings', () => {
    const candidate: AssetCandidate = {
      processId: assetA,
      height: 1,
      timestamp: 1,
      sources: ['market-action'],
    };
    const result = {
      asset: collections[0].assets[0],
      collection: collections[0],
      provider: 'https://compute.example',
      activity: candidate,
      state: parseAssetState({
        'execution-device': 'token@1.0',
        'total-supply': 1,
        balances: {},
        orders: {
          [orderId]: {
            'order-id': orderId,
            creator: wallet,
            recipient: wallet,
            asking: '100000000',
            deposit: '0',
            'minimum-fee': '100000000',
            deadline: 20,
            'created-at': 1,
            quantity: 1,
            status: 'open',
          },
        },
      }),
    };

    expect(walletAssetGroup(result, wallet)).toBe('listed');
    expect(isLiveListing(result)).toBe(true);
    expect(walletAssetGroup(result, buyer)).toBeNull();
    expect(
      walletAssetGroup(
        {
          ...result,
          state: parseAssetState({
            'execution-device': 'token@1.0',
            'total-supply': 1,
            balances: { [wallet]: '1' },
            orders: {},
          }),
        },
        wallet,
      ),
    ).toBe('owned');
    expect(
      isLiveListing({
        ...result,
        state: parseAssetState({
          'execution-device': 'token@1.0',
          'total-supply': 1,
          balances: { [wallet]: '1' },
          orders: {
            [orderId]: {
              'order-id': orderId,
              creator: wallet,
              recipient: wallet,
              asking: '100000000',
              deadline: 20,
              quantity: 1,
              status: 'cancelled',
            },
          },
        }),
      }),
    ).toBe(false);
  });
});
