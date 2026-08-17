import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearArweaveHeightCache, currentArweaveHeight } from './arweave-height';

beforeEach(clearArweaveHeightCache);
afterEach(() => vi.restoreAllMocks());

describe('currentArweaveHeight', () => {
	it('coalesces concurrent reads and reuses one fresh selected-gateway height', async () => {
		let now = 1_000;
		vi.spyOn(Date, 'now').mockImplementation(() => now);
		const fetcher = vi.fn<typeof fetch>(async () => Response.json({ network: 'arweave.N.1', height: 1_980_357 }));
		const options = { fetch: fetcher, gateway: 'https://gateway.example' };

		const [first, second] = await Promise.all([currentArweaveHeight(options), currentArweaveHeight(options)]);
		now += 9_999;
		const cached = await currentArweaveHeight(options);

		expect([first, second, cached]).toEqual([1_980_357, 1_980_357, 1_980_357]);
		expect(fetcher).toHaveBeenCalledTimes(1);
		expect(fetcher.mock.calls[0][0]).toBe('https://gateway.example/info');
		expect(fetcher.mock.calls[0][1]).toMatchObject({ cache: 'no-store' });

		now += 2;
		await currentArweaveHeight(options);
		expect(fetcher).toHaveBeenCalledTimes(2);
	});

	it('lets one caller abort without cancelling the shared read', async () => {
		let resolve!: (response: Response) => void;
		const fetcher = vi.fn<typeof fetch>(() => new Promise<Response>((done) => (resolve = done)));
		const controller = new AbortController();
		const options = { fetch: fetcher, gateway: 'https://gateway.example' };
		const aborted = currentArweaveHeight({ ...options, signal: controller.signal });
		const shared = currentArweaveHeight(options);

		controller.abort(new Error('caller-aborted'));
		await expect(aborted).rejects.toThrow('caller-aborted');
		resolve(Response.json({ network: 'arweave.N.1', height: 1_980_357 }));

		await expect(shared).resolves.toBe(1_980_357);
		expect(fetcher).toHaveBeenCalledTimes(1);
	});

	it('does not cache a failed or malformed height response', async () => {
		const fetcher = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(new Response('unavailable', { status: 503 }))
			.mockResolvedValueOnce(Response.json({ network: 'arweave.N.1', height: 'not-a-height' }))
			.mockResolvedValueOnce(Response.json({ network: 'arweave.N.1', height: 1_980_357 }));
		const options = { fetch: fetcher, gateway: 'https://gateway.example' };

		await expect(currentArweaveHeight(options)).rejects.toThrow('network-info-503');
		await expect(currentArweaveHeight(options)).rejects.toThrow('invalid-network-height');
		await expect(currentArweaveHeight(options)).resolves.toBe(1_980_357);
		expect(fetcher).toHaveBeenCalledTimes(3);
	});
});
