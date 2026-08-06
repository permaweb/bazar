import { beforeEach, describe, expect, it, vi } from 'vitest';

const control = vi.hoisted(() => ({
  constructed: [] as Array<Record<string, unknown>>,
  ready: 0,
  stopped: 0,
}));

vi.mock('./arweave-observers', () => ({
  ArweaveObserverNetwork: class {
    constructor(options: Record<string, unknown>) {
      control.constructed.push(options);
    }
    ready() {
      control.ready += 1;
      return Promise.resolve([]);
    }
    watch(id: string) {
      return { id };
    }
    stop() {
      control.stopped += 1;
    }
  },
}));

import { acquireAssetObserverNetwork } from './asset-observers';

function location(node: string): Location {
  return {
    protocol: 'https:',
    hostname: 'bazar.example',
    port: '',
    search: `?node=${encodeURIComponent(node)}`,
    hash: '',
  } as Location;
}

describe('shared asset observer network', () => {
  beforeEach(() => {
    control.constructed.length = 0;
    control.ready = 0;
    control.stopped = 0;
  });

  it('shares discovery and transport for concurrent operations on one gateway', () => {
    const first = acquireAssetObserverNetwork(location('https://alpha.example'));
    const second = acquireAssetObserverNetwork(location('https://alpha.example'));

    expect(second.network).toBe(first.network);
    expect(second.ready).toBe(first.ready);
    expect(control.constructed).toHaveLength(1);
    expect(control.ready).toBe(1);

    first.release();
    expect(control.stopped).toBe(0);
    second.release();
    expect(control.stopped).toBe(1);
  });

  it('keeps transaction watchers independent', () => {
    const first = acquireAssetObserverNetwork(location('https://alpha.example'));
    const second = acquireAssetObserverNetwork(location('https://alpha.example'));
    const firstWatcher = first.network.watch('A'.repeat(43));
    const secondWatcher = second.network.watch('B'.repeat(43));

    expect(firstWatcher).not.toBe(secondWatcher);
    expect(firstWatcher).toMatchObject({ id: 'A'.repeat(43) });
    expect(secondWatcher).toMatchObject({ id: 'B'.repeat(43) });

    first.release();
    second.release();
  });

  it('keeps selected gateways isolated', () => {
    const alpha = acquireAssetObserverNetwork(location('https://alpha.example'));
    const beta = acquireAssetObserverNetwork(location('https://beta.example'));

    expect(beta.network).not.toBe(alpha.network);
    expect(control.constructed).toHaveLength(2);

    alpha.release();
    beta.release();
    expect(control.stopped).toBe(2);
  });

  it('makes lease release idempotent', () => {
    const lease = acquireAssetObserverNetwork(location('https://alpha.example'));

    lease.release();
    lease.release();

    expect(control.stopped).toBe(1);
  });
});
