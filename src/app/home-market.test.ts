import { describe, expect, it } from 'vitest';

import type { Collection } from 'api/collections';
import {
  collectionActivityVersion,
  collectionActivityScanAnnouncement,
  collectionCandidateMembership,
  collectionAssetWindowDelta,
  collectionListingScopeVersion,
  commitHomeActivityBatch,
  commitHomeFloorResult,
  completeHomeActivityScan,
  completeHomeSummaryRetryGroup,
  homeAssetTypeMatches,
  homeSummaryRequestKeys,
  homeDiscoveryAssets,
  homeMarketPriceValue,
  homeScrollIndicatorMetrics,
  homeFloorScanSummary,
  mergeResolvedListingBatch,
  newestCollectionActivity,
  nextListingAnnouncementProgress,
  pendingHomeActivityRecipients,
  pendingHomeFloorCandidates,
  reconcileHomeActivityScan,
  reconcileHomeFloorScan,
  retryableHomeSummaryKeys,
  type HomeMarketSummary,
} from './App';

describe('Home market summary retries', () => {
  it('sizes and positions persistent pane scroll indicators', () => {
    expect(homeScrollIndicatorMetrics(0, 1_200, 600)).toEqual({ visible: true, size: 150, offset: 0 });
    expect(homeScrollIndicatorMetrics(300, 1_200, 600)).toEqual({ visible: true, size: 150, offset: 225 });
    expect(homeScrollIndicatorMetrics(0, 600, 600)).toEqual({ visible: false, size: 600, offset: 0 });
  });

  it('keeps the indicator within a track below the sticky heading', () => {
    expect(homeScrollIndicatorMetrics(300, 1_200, 600, 492)).toEqual({
      visible: true,
      size: 123,
      offset: 184.5,
    });
  });

  it('separates fungible tokens from atomic assets', () => {
    const tokenCollection: Collection = {
      id: 'tokens',
      name: 'Tokens',
      description: '',
      kind: 'tokens',
      assets: [],
    };
    const nameCollection: Collection = {
      id: 'names',
      name: 'Names',
      description: '',
      kind: 'names',
      assets: [],
    };
    const imageCollection: Collection = {
      id: 'images',
      name: 'Images',
      description: '',
      kind: 'images',
      assets: [],
    };

    expect(
      [tokenCollection, nameCollection, imageCollection].filter((collection) =>
        homeAssetTypeMatches(collection, 'all'),
      ),
    ).toHaveLength(3);
    expect(
      [tokenCollection, nameCollection, imageCollection].filter((collection) =>
        homeAssetTypeMatches(collection, 'tokens'),
      ),
    ).toEqual([tokenCollection]);
    expect(
      [tokenCollection, nameCollection, imageCollection].filter((collection) =>
        homeAssetTypeMatches(collection, 'atomic'),
      ),
    ).toEqual([nameCollection, imageCollection]);
  });

  it('keeps verified Arweave names in the discovery mosaic', () => {
    const name = { id: 'n'.repeat(43), name: 'alice' };
    const image = { id: 'i'.repeat(43), name: 'Image', image: 'https://arweave.net/image' };
    const collections: Collection[] = [
      { id: 'names', name: 'Names', description: '', kind: 'names', assets: [] },
      { id: 'images', name: 'Images', description: '', kind: 'images', assets: [image] },
    ];

    expect(homeDiscoveryAssets(collections, { names: [name] }, 10)).toEqual([
      { asset: name, collection: collections[0] },
      { asset: image, collection: collections[1] },
    ]);
  });

  it('sorts NFT and fungible AR price labels by their numeric amount', () => {
    expect(homeMarketPriceValue('0.000001 AR / WEAVE')).toBe(0.000001);
    expect(homeMarketPriceValue('1,234.5 AR')).toBe(1234.5);
    expect(homeMarketPriceValue('Unavailable')).toBe(Number.POSITIVE_INFINITY);
  });

  it('checks exact collection membership without rescanning loaded assets', () => {
    const loadedImage = 'i'.repeat(43);
    const loadedToken = 't'.repeat(43);
    const canonicalName = 'n'.repeat(43);
    const staleLoadedName = 's'.repeat(43);
    const foreign = 'f'.repeat(43);
    const imageIncludes = collectionCandidateMembership({
      id: 'images',
      name: 'Images',
      description: '',
      kind: 'images',
      assets: [{ id: loadedImage, name: 'Image' }],
    });
    const tokenIncludes = collectionCandidateMembership({
      id: 'tokens',
      name: 'Tokens',
      description: '',
      kind: 'tokens',
      assets: [{ id: loadedToken, name: 'Token' }],
    });
    const nameIncludes = collectionCandidateMembership({
      id: 'names',
      name: 'Names',
      description: '',
      kind: 'names',
      assets: [{ id: staleLoadedName, name: 'Stale' }],
      namespace: {
        manifestId: 'm'.repeat(43),
        namesById: { [canonicalName]: 'canonical' },
      },
    });

    expect([imageIncludes(loadedImage), imageIncludes(foreign)]).toEqual([true, false]);
    expect([tokenIncludes(loadedToken), tokenIncludes(foreign)]).toEqual([true, false]);
    expect([nameIncludes(canonicalName), nameIncludes(staleLoadedName)]).toEqual([true, false]);
  });

  it('screens a large collection candidate set with exact indexed membership', () => {
    const ids = Array.from({ length: 16_653 }, (_, index) => `${String(index).padStart(42, '0')}A`);
    const includes = collectionCandidateMembership({
      id: 'large',
      name: 'Large',
      description: '',
      kind: 'images',
      assets: ids.map((id) => ({ id, name: id })),
    });
    const candidates = Array.from({ length: 13_769 }, (_, index) =>
      index % 3 === 0 ? `${String(index).padStart(42, '0')}Z` : ids[index],
    );

    expect(candidates.filter(includes)).toHaveLength(9_179);
  });

  it('announces large activity scans only at bounded batch milestones', () => {
    const messages = new Set(
      Array.from({ length: 160 }, (_, index) =>
        collectionActivityScanAnnouncement({
          error: false,
          events: index * 3,
          loading: true,
          pages: index + 1,
          preservingEvents: false,
        }),
      ),
    );

    expect(messages.size).toBe(17);
    expect(messages).toContain('Activity scan checked 1 batch so far.');
    expect(messages).toContain('Activity scan checked 150 batches so far.');
    expect(
      collectionActivityScanAnnouncement({
        error: false,
        events: 18,
        loading: false,
        pages: 160,
        preservingEvents: false,
      }),
    ).toBe('Activity scan complete. 18 indexed events found.');
  });

  it('selects unavailable and still-pending summaries for an in-place retry', () => {
    const summaries: Record<string, HomeMarketSummary> = {
      listed: { status: 'resolved', value: '0.001 AR' },
      empty: { status: 'unindexed' },
      throttled: { status: 'unavailable', source: 'compute', kind: 'rate-limited' },
      index: { status: 'unavailable', source: 'index', kind: 'unavailable' },
    };

    expect(retryableHomeSummaryKeys(['listed', 'empty', 'throttled', 'index', 'pending'], summaries)).toEqual([
      'throttled',
      'index',
      'pending',
    ]);
  });

  it('starts only new work while an unchanged summary remains in flight', () => {
    expect(homeSummaryRequestKeys(['existing', 'arrived'], {}, ['existing'], new Set())).toEqual(['arrived']);
  });

  it('restarts an explicitly retried in-flight summary', () => {
    expect(
      homeSummaryRequestKeys(
        ['pending', 'settled'],
        { settled: { status: 'resolved', value: null } },
        ['pending'],
        new Set(['pending']),
      ),
    ).toEqual(['pending']);
  });

  it('keeps retry ownership until replacement requests finish', () => {
    const run = { token: 1, pending: new Set<'assets' | 'collections'>(['assets', 'collections']) };

    expect(completeHomeSummaryRetryGroup(run, 1, 'assets', 1)).toBe(false);
    expect(run.pending.has('assets')).toBe(true);
    expect(completeHomeSummaryRetryGroup(run, 1, 'assets', 0)).toBe(false);
    expect(run.pending.has('assets')).toBe(false);
    expect(completeHomeSummaryRetryGroup(run, 1, 'collections', 0)).toBe(true);
    expect(run.pending.size).toBe(0);
  });

  it('ignores completion from an obsolete retry token', () => {
    const run = { token: 2, pending: new Set<'assets' | 'collections'>(['assets']) };

    expect(completeHomeSummaryRetryGroup(run, 1, 'assets', 0)).toBe(false);
    expect(run.pending.has('assets')).toBe(true);
  });
});

describe('Home collection activity windows', () => {
  it('retains completed windows and retries only pending recipients', () => {
    const recipients = Array.from({ length: 205 }, (_, index) => `${index}`.padStart(43, 'A'));
    const firstWindow = recipients.slice(0, 100);
    const scan = reconcileHomeActivityScan(undefined, recipients);
    commitHomeActivityBatch(scan, [{ processId: firstWindow[0], height: 10 } as any], firstWindow);

    expect(pendingHomeActivityRecipients(scan, recipients)).toEqual(recipients.slice(100));
    expect(scan.candidates.get(firstWindow[0])?.height).toBe(10);
  });

  it('merges later successful windows without publishing or losing earlier candidates', () => {
    const first = 'A'.repeat(43);
    const second = 'B'.repeat(43);
    const scan = reconcileHomeActivityScan(undefined, [first, second]);
    commitHomeActivityBatch(scan, [{ processId: first, height: 20 } as any], [first]);
    expect(pendingHomeActivityRecipients(scan, [first, second])).toEqual([second]);
    commitHomeActivityBatch(scan, [{ processId: second, height: 30 } as any], [second]);

    expect([...scan.candidates.keys()]).toEqual([first, second]);
    expect(pendingHomeActivityRecipients(scan, [first, second])).toEqual([]);
  });

  it('deduplicates recipients and resets after collection members are removed', () => {
    const kept = 'A'.repeat(43);
    const removed = 'B'.repeat(43);
    const scan = reconcileHomeActivityScan(undefined, [kept, removed, kept]);
    commitHomeActivityBatch(
      scan,
      [{ processId: kept, height: 20 } as any, { processId: removed, height: 10 } as any],
      [kept, removed],
    );
    const reconciled = reconcileHomeActivityScan(scan, [kept, kept]);

    expect([...reconciled.members]).toEqual([kept]);
    expect([...reconciled.completed]).toEqual([]);
    expect([...reconciled.candidates.keys()]).toEqual([]);
    expect(pendingHomeActivityRecipients(reconciled, [kept, kept])).toEqual([kept]);
  });

  it('preserves completed windows when an incomplete index scan grows', () => {
    const first = 'A'.repeat(43);
    const added = 'B'.repeat(43);
    const scan = reconcileHomeActivityScan(undefined, [first]);
    commitHomeActivityBatch(scan, [], [first]);
    const reconciled = reconcileHomeActivityScan(scan, [first, added]);

    expect(pendingHomeActivityRecipients(reconciled, [first, added])).toEqual([added]);
  });

  it('rescans every member when a completed collection grows', () => {
    const first = 'A'.repeat(43);
    const added = 'B'.repeat(43);
    const scan = reconcileHomeActivityScan(undefined, [first]);
    commitHomeActivityBatch(scan, [{ processId: first, height: 10 } as any], [first]);
    completeHomeActivityScan(scan, [first]);
    const reconciled = reconcileHomeActivityScan(scan, [first, added]);

    expect(reconciled.indexComplete).toBe(false);
    expect(pendingHomeActivityRecipients(reconciled, [first, added])).toEqual([first, added]);
    expect(reconciled.candidates.has(first)).toBe(true);
  });

  it('keeps a complete scan through a pure collection reorder', () => {
    const first = 'A'.repeat(43);
    const second = 'B'.repeat(43);
    const scan = reconcileHomeActivityScan(undefined, [first, second]);
    commitHomeActivityBatch(scan, [], [first, second]);
    completeHomeActivityScan(scan, [first, second]);
    const reconciled = reconcileHomeActivityScan(scan, [second, first]);

    expect(reconciled.indexComplete).toBe(true);
    expect(pendingHomeActivityRecipients(reconciled, [second, first])).toEqual([]);
  });

  it('rejects foreign candidates before committing a discovery batch', () => {
    const requested = 'A'.repeat(43);
    const foreign = 'B'.repeat(43);
    const scan = reconcileHomeActivityScan(undefined, [requested]);

    expect(() => commitHomeActivityBatch(scan, [{ processId: foreign, height: 10 } as any], [requested])).toThrow(
      'home-activity-batch-out-of-scope',
    );
    expect(scan.completed.size).toBe(0);
    expect(scan.candidates.size).toBe(0);
  });
});

describe('Home collection floor retries', () => {
  const activity = (processId: string, height = 1, timestamp = height) => ({
    processId,
    height,
    timestamp,
  });

  it('retains 999 live contributions and retries only one failed candidate', () => {
    const candidates = Array.from({ length: 1000 }, (_, index) => `asset-${index}`);
    let scan = reconcileHomeFloorScan(
      undefined,
      'scope-a',
      candidates.map((processId) => activity(processId)),
    );
    for (const [index, processId] of candidates.entries()) {
      if (index === 719) commitHomeFloorResult(scan, processId, null, 'unavailable');
      else commitHomeFloorResult(scan, processId, index === 500 ? 5n : 10n);
    }
    expect(pendingHomeFloorCandidates(scan)).toEqual([candidates[719]]);
    expect(homeFloorScanSummary(scan)).toEqual({ status: 'unavailable', source: 'compute', kind: 'unavailable' });

    scan = reconcileHomeFloorScan(
      scan,
      'scope-a',
      candidates.map((processId) => activity(processId)),
    );
    commitHomeFloorResult(scan, candidates[719], 7n);
    expect(pendingHomeFloorCandidates(scan)).toEqual([]);
    expect(homeFloorScanSummary(scan)).toEqual({ status: 'resolved', value: '0.000000000005 AR' });
  });

  it('treats a verified no-ask result as settled and prunes removed minima', () => {
    const noAsk = 'no-ask';
    const minimum = 'minimum';
    const other = 'other';
    let scan = reconcileHomeFloorScan(
      undefined,
      'scope-a',
      [noAsk, minimum, other].map((id) => activity(id)),
    );
    commitHomeFloorResult(scan, noAsk, null);
    commitHomeFloorResult(scan, minimum, 1_000_000_000_000n);
    commitHomeFloorResult(scan, other, 2_000_000_000_000n);
    expect(pendingHomeFloorCandidates(scan)).toEqual([]);
    expect(homeFloorScanSummary(scan)).toEqual({ status: 'resolved', value: '1 AR' });

    scan = reconcileHomeFloorScan(
      scan,
      'scope-a',
      [noAsk, other].map((id) => activity(id)),
    );
    expect(pendingHomeFloorCandidates(scan)).toEqual([]);
    expect(homeFloorScanSummary(scan)).toEqual({ status: 'resolved', value: '2 AR' });
  });

  it('clears retained compute contributions when the gateway or collection scope changes', () => {
    const scan = reconcileHomeFloorScan(undefined, 'gateway-a:version-a', [activity('asset')]);
    commitHomeFloorResult(scan, 'asset', 1n);
    const replaced = reconcileHomeFloorScan(scan, 'gateway-b:version-a', [activity('asset')]);

    expect(pendingHomeFloorCandidates(replaced)).toEqual(['asset']);
    expect(replaced.settled.size).toBe(0);
  });

  it('revalidates only a candidate whose latest indexed activity changed', () => {
    let scan = reconcileHomeFloorScan(undefined, 'scope', [activity('changed', 1), activity('stable', 1)]);
    commitHomeFloorResult(scan, 'changed', 1n);
    commitHomeFloorResult(scan, 'stable', 2n);

    scan = reconcileHomeFloorScan(scan, 'scope', [activity('changed', 2), activity('stable', 1)]);
    expect(pendingHomeFloorCandidates(scan)).toEqual(['changed']);
    expect(scan.settled.get('stable')).toBe(2n);
  });

  it('rejects stale or foreign result commits', () => {
    const scan = reconcileHomeFloorScan(undefined, 'scope', [activity('asset')]);
    expect(() => commitHomeFloorResult(scan, 'foreign', 1n)).toThrow('home-floor-result-out-of-scope');
  });
});

describe('Collection activity scope', () => {
  const asset = { id: 'A'.repeat(43), name: 'Asset' };

  it('changes with a names namespace replacement', () => {
    const collection: Collection = {
      id: 'names',
      name: 'Names',
      description: '',
      kind: 'names',
      assets: [asset],
      namespace: { manifestId: 'M'.repeat(43), namesById: { [asset.id]: 'asset' } },
    };

    expect(collectionActivityVersion(collection)).not.toBe(
      collectionActivityVersion({
        ...collection,
        namespace: { ...collection.namespace!, manifestId: 'N'.repeat(43) },
      }),
    );
  });

  it('changes when another paged token enters the loaded window', () => {
    const collection: Collection = {
      id: 'tokens',
      name: 'Tokens',
      description: '',
      kind: 'tokens',
      assets: [asset],
      manifestId: 'M'.repeat(43),
    };

    expect(collectionActivityVersion(collection)).not.toBe(
      collectionActivityVersion({
        ...collection,
        assets: [...collection.assets, { id: 'B'.repeat(43), name: 'Another asset' }],
      }),
    );
  });

  it('keeps listing scope stable when a paged token window only grows', () => {
    const collection: Collection = {
      id: 'tokens',
      name: 'Tokens',
      description: '',
      kind: 'tokens',
      assets: [asset],
      manifestId: 'M'.repeat(43),
    };

    expect(collectionListingScopeVersion(collection)).toBe(
      collectionListingScopeVersion({
        ...collection,
        assets: [...collection.assets, { id: 'B'.repeat(43), name: 'Another asset' }],
      }),
    );
  });

  it('checks only the newly loaded token window and resets after removal', () => {
    expect(collectionAssetWindowDelta(['a', 'b'], ['a', 'b', 'c', 'd'])).toEqual({
      reset: false,
      added: ['c', 'd'],
    });
    expect(collectionAssetWindowDelta(['a', 'b'], ['b', 'c'])).toEqual({
      reset: true,
      added: ['b', 'c'],
    });
  });

  it('keeps an aborted token delta in the next incremental request', () => {
    const scanned = new Set(['a']);
    expect(collectionAssetWindowDelta(scanned, ['a', 'b']).added).toEqual(['b']);
    // The b request aborts, so only successfully scanned a remains committed.
    expect(collectionAssetWindowDelta(scanned, ['a', 'b', 'c']).added).toEqual(['b', 'c']);
  });
});

describe('Collection listing announcements', () => {
  it('keeps announced progress monotonic as discovered pages expand the total', () => {
    const sequence = [
      { resolved: 100, total: 100, failures: 3 },
      { resolved: 100, total: 200, failures: 3 },
      { resolved: 200, total: 200, failures: 6 },
      { resolved: 200, total: 300, failures: 6 },
      { resolved: 300, total: 300, failures: 9 },
    ];
    let progress = { scope: 'collection', resolved: 0, failures: 0 };
    const announced = sequence.map((step) => {
      progress = nextListingAnnouncementProgress(progress, {
        ...step,
        scope: 'collection',
        loading: true,
      });
      return progress.resolved;
    });

    expect(announced).toEqual([100, 100, 200, 200, 300]);
  });

  it('holds failure churn until a milestone and reports exact completion immediately', () => {
    const initial = { scope: 'collection', resolved: 0, failures: 0 };
    const belowMilestone = nextListingAnnouncementProgress(initial, {
      scope: 'collection',
      resolved: 7,
      failures: 7,
      total: 100,
      loading: true,
    });
    expect(belowMilestone).toEqual(initial);
    expect(
      nextListingAnnouncementProgress(belowMilestone, {
        scope: 'collection',
        resolved: 7,
        failures: 7,
        total: 100,
        loading: false,
      }),
    ).toEqual({ scope: 'collection', resolved: 7, failures: 7 });
  });
});

describe('Collection activity windows', () => {
  it('deduplicates completion-order results and retains the exact newest limit', () => {
    const events = Array.from({ length: 205 }, (_, index) => ({
      id: `event-${index}`,
      processId: `process-${index}`,
      action: 'transfer' as const,
      actor: 'actor',
      height: index + 1,
      timestamp: (index + 1) * 10,
    }));
    expect(
      newestCollectionActivity([...events.slice(100), ...events.slice(0, 100), events[204]]).map((event) => event.id),
    ).toEqual(
      events
        .slice(105)
        .reverse()
        .map((event) => event.id),
    );
  });
});

describe('Collection live listing truth', () => {
  const liveListing = (id: string, marker = id) =>
    ({
      asset: { id, name: marker },
      state: { orders: { order: { status: 'open' } } },
    }) as any;

  it('merges a resolution batch once with last-outcome truth', () => {
    const first = { asset: { id: 'a' } } as any;
    const second = { asset: { id: 'b' } } as any;
    const untouched = liveListing('d');
    const latest = liveListing('a', 'latest');
    expect(
      mergeResolvedListingBatch(
        [first, second, untouched],
        [
          { processId: 'a', result: liveListing('a', 'older') },
          { processId: 'b', result: null },
          { processId: 'c', result: liveListing('c') },
          { processId: 'a', result: latest },
        ],
      ),
    ).toEqual([untouched, liveListing('c'), latest]);
  });

  it('restores a listing only from a successful current live-state result', () => {
    const previous = { asset: { id: 'a' } } as any;
    const current = liveListing('a');
    expect(mergeResolvedListingBatch([previous], [{ processId: 'a', result: current }])).toEqual([current]);
  });

  it('consumes a 10,000-listing resolution iterable exactly once', () => {
    let iterations = 0;
    const outcomes = {
      *[Symbol.iterator]() {
        iterations += 1;
        if (iterations > 1) throw new Error('resolution batch was consumed twice');
        for (let index = 0; index < 10_000; index += 1) {
          const processId = `${String(index).padStart(42, '0')}A`;
          yield { processId, result: liveListing(processId) };
        }
      },
    };

    const merged = mergeResolvedListingBatch([], outcomes);
    expect(iterations).toBe(1);
    expect(merged).toHaveLength(10_000);
    expect(new Set(merged.map((result) => result.asset.id)).size).toBe(10_000);
  });
});
