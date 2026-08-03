import { describe, expect, it } from 'vitest';

import {
  CREATED_COLLECTION_ID,
  assetFromMintState,
  createdCollection,
  isBazarMintTags,
  loadMintedAssets,
  loadMintedCollections,
  mintMetadata,
  mintProcessTags,
  storeMintedAsset,
  storeMintedCollection,
} from './asset-mint';

const owner = 'W'.repeat(43);
const mediaId = 'M'.repeat(43);
const processId = 'P'.repeat(43);

function storage() {
  const held = new Map<string, string>();
  return {
    getItem: (key: string) => held.get(key) ?? null,
    setItem: (key: string, value: string) => void held.set(key, value),
    removeItem: (key: string) => void held.delete(key),
  };
}

describe('asset mint contract', () => {
  it('creates a one-of-one swap-enabled token process', () => {
    const tags = mintProcessTags({ name: 'Signal #1', contentType: 'image/png', mediaId }, owner);

    expect(tags).toMatchObject({
      'App-Name': 'Bazar',
      type: 'Process',
      'execution-device': 'token@1.0',
      'swap-device': 'arweave-swap@1.0',
      'initial-holder': owner,
      'total-supply': '1',
      'asset-data': mediaId,
    });
    expect(
      mintProcessTags(
        {
          name: 'Signal #1',
          contentType: 'image/png',
          mediaId,
          collection: 'Signal set',
        },
        owner,
      ).collection,
    ).toBe('Signal set');
    expect(
      isBazarMintTags(Object.fromEntries(Object.entries(tags).map(([key, value]) => [key.toLowerCase(), value]))),
    ).toBe(true);
    expect(
      mintMetadata({ name: ' Signal #1 ', description: ' Permanent ', contentType: 'image/png' }, mediaId),
    ).toEqual({
      name: 'Signal #1',
      description: 'Permanent',
      contentType: 'image/png',
      image: mediaId,
      collection: 'Created on Bazar',
    });
  });

  it('restores locally indexed minted assets without accepting malformed entries', () => {
    const store = storage();
    storeMintedAsset(
      {
        id: processId,
        name: 'Signal #1',
        description: 'Permanent',
        contentType: 'image/png',
        image: `https://arweave.net/${mediaId}`,
        mediaId,
        owner,
        createdAt: 1,
      },
      store,
    );

    expect(loadMintedAssets(store)).toHaveLength(1);
    expect(createdCollection(loadMintedAssets(store))).toMatchObject({
      id: CREATED_COLLECTION_ID,
      total: 1,
    });
    expect(
      assetFromMintState(processId, {
        name: 'Signal #1',
        'asset-data': mediaId,
        'asset-content-type': 'image/png',
      }),
    ).toEqual({
      id: processId,
      name: 'Signal #1',
      contentType: 'image/png',
      image: `https://arweave.net/${mediaId}`,
    });
  });

  it('persists a minted collection by its permanent reference transaction', () => {
    const store = storage();
    const asset = {
      id: processId,
      name: 'Signal #1',
      description: 'Permanent',
      contentType: 'image/png',
      image: `https://arweave.net/${mediaId}`,
      mediaId,
      owner,
      createdAt: 1,
    };
    storeMintedCollection(
      {
        id: 'R'.repeat(43),
        manifestId: 'N'.repeat(43),
        owner,
        createdAt: 2,
        name: 'Signal set',
        description: 'A collection',
        kind: 'images',
        assets: [asset],
        total: 1,
      },
      store,
    );

    expect(loadMintedCollections(store)).toMatchObject([
      {
        id: 'R'.repeat(43),
        manifestId: 'N'.repeat(43),
        name: 'Signal set',
        total: 1,
      },
    ]);
  });
});
