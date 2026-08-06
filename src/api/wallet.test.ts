import { describe, expect, it, vi } from 'vitest';

import { readWalletBalance } from './wallet';

describe('readWalletBalance', () => {
	it('reads and validates a winston balance without loading transaction tooling', async () => {
		const fetcher = vi.fn().mockResolvedValue(new Response('1234', { status: 200 }));
		await expect(readWalletBalance('A'.repeat(43), { fetch: fetcher, gateway: 'https://node.example' })).resolves.toBe(
			1234n,
		);
		expect(fetcher).toHaveBeenCalledWith(
			`https://node.example/wallet/${'A'.repeat(43)}/balance`,
			expect.objectContaining({ signal: undefined }),
		);
	});
});
