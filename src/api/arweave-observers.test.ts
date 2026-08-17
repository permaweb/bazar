import { describe, expect, it, vi } from 'vitest';
import { type Observer, type TxWatcher, WeaveNetwork } from 'weave-wrangler';

import { ArweaveObserverNetwork } from './arweave-observers';
import {
	ARWEAVE_OBSERVER_PENDING_INTERVAL_MS,
	observerDiscoveryComplete,
	observerWatchOptions,
} from './observer-policy';

const observer = (index = 0): Observer => ({
	url: `http://127.0.0.${index + 1}:1984`,
	label: `Observer ${index + 1}`,
	source: 'peer',
	failures: 0,
	height: 1,
});

describe('Arweave observer request pacing', () => {
	it('raises aggressive pending polling to nine seconds', () => {
		expect(observerWatchOptions({ pendingInterval: 2_000 }).pendingInterval).toBe(
			ARWEAVE_OBSERVER_PENDING_INTERVAL_MS
		);
		expect(observerWatchOptions({ pendingInterval: 12_000 }).pendingInterval).toBe(12_000);
	});

	it('stops both peer-discovery routes after seven healthy observers are active', () => {
		expect(observerDiscoveryComplete(6, '/peers')).toBe(false);
		expect(observerDiscoveryComplete(7, '/peers')).toBe(true);
		expect(observerDiscoveryComplete(7, '/~arweave@2.9/peers?require-codec=json%401.0')).toBe(true);
		expect(observerDiscoveryComplete(7, '/info')).toBe(false);
		expect(observerDiscoveryComplete(7, `/tx/${'T'.repeat(43)}/status`)).toBe(false);
	});

	it('applies the pacing policy to watchers created by the network wrapper', () => {
		const watch = vi.spyOn(WeaveNetwork.prototype, 'watch').mockReturnValue({} as TxWatcher);
		const network = new ArweaveObserverNetwork({ useDefaultSeeds: false, spider: false });

		network.watch('T'.repeat(43), { pendingInterval: 2_000 });

		expect(watch).toHaveBeenCalledWith('T'.repeat(43), expect.objectContaining({ pendingInterval: 9_000 }));
		watch.mockRestore();
		network.stop();
	});

	it('pauses peer requests without permanently exhausting their discovery source', async () => {
		const network = new ArweaveObserverNetwork({ useDefaultSeeds: false, spider: false });
		vi.spyOn(network, 'active').mockReturnValue(Array.from({ length: 7 }, (_, index) => observer(index)));

		await expect(network.request(observer(), '/peers')).resolves.toMatchObject({
			ok: false,
			status: 0,
			error: 'observer-discovery-paused',
		});

		network.stop();
	});
});
