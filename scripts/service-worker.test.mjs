import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

describe('service worker cache ownership', () => {
	it('removes only superseded Bazar static caches', async () => {
		const listeners = new Map();
		const remove = vi.fn(async () => true);
		vm.runInNewContext(await readFile(new URL('../public/service-worker.js', import.meta.url), 'utf8'), {
			URL,
			caches: {
				delete: remove,
				keys: async () => ['bazar-static-v1', 'bazar-static-v2', 'ao-wrangler/hashpaths-v1'],
			},
			fetch: vi.fn(),
			self: {
				addEventListener: (name, listener) => listeners.set(name, listener),
				clients: { claim: vi.fn(async () => undefined) },
				registration: { scope: 'https://bazar.example/' },
				skipWaiting: vi.fn(),
			},
		});
		let completion;
		listeners.get('activate')({ waitUntil: (pending) => (completion = pending) });
		await completion;

		expect(remove).toHaveBeenCalledOnce();
		expect(remove).toHaveBeenCalledWith('bazar-static-v1');
	});
});
