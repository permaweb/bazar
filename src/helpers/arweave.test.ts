import { describe, expect, it, vi } from 'vitest';

const chunk = vi.hoisted(() => ({ attempts: 0 }));

vi.mock('arweave', () => {
	chunk.attempts += 1;
	if (chunk.attempts === 1) throw new Error('Failed to fetch dynamically imported module');
	return { default: { init: (config: unknown) => ({ config }) } };
});

import { createArweaveClient } from './arweave';

describe('Arweave client loader', () => {
	it('retries the module import after a failed chunk load instead of caching the rejection', async () => {
		await expect(createArweaveClient()).rejects.toThrow();
		await expect(createArweaveClient({ host: 'example.test' })).resolves.toEqual({
			config: { host: 'example.test' },
		});
		expect(chunk.attempts).toBe(2);
	});
});
