import { describe, expect, it, vi } from 'vitest';

import { AtomicAssetUploader } from './asset-uploader';

const owner = 'W'.repeat(43);

function transaction() {
	return {
		id: '',
		owner: '',
		chunks: { chunks: [{}] },
		tags: [] as Array<[string, string]>,
		addTag(name: string, value: string) {
			this.tags.push([name, value]);
		},
		toJSON() {
			return { id: this.id, owner: this.owner, tags: this.tags };
		},
	};
}

describe('atomic asset uploader', () => {
	it('publishes one-of-one and fungible assets through the same runtime-neutral adapter', async () => {
		const created: Array<Record<string, unknown>> = [];
		const posted: string[] = [];
		let index = 0;
		const uploader = new AtomicAssetUploader({
			gateway: 'https://gateway.example',
			fetch: vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
				const url = String(input);
				if (url.includes('/price/')) return new Response('1');
				if (url.includes('/wallet/')) return new Response('100');
				if (init?.method === 'POST') posted.push(url);
				return new Response('', { status: 200 });
			}),
			adapter: {
				createTransaction: vi.fn(async (attributes) => {
					created.push(attributes);
					return transaction();
				}),
				signTransaction: vi.fn(async (held) => {
					held.id = String.fromCharCode(65 + index++).repeat(43);
					held.owner = 'signed-owner';
					return held;
				}),
				ownerToAddress: vi.fn(async () => owner),
			},
		});

		const commonTags = {
			device: 'process@1.0',
			type: 'Process',
			'execution-device': 'token@1.0',
		};
		await uploader.uploadAtomicAsset(
			{
				data: new Uint8Array([1, 2, 3]),
				tags: { ...commonTags, 'content-type': 'image/png', 'hint-ui-style': 'non-fungible' },
			},
			owner
		);
		await uploader.uploadAtomicAsset(
			{
				data: JSON.stringify({ name: 'CLI token' }),
				tags: { ...commonTags, 'content-type': 'application/json', 'hint-ui-style': 'fungible' },
			},
			owner
		);

		expect(created).toEqual([{ data: new Uint8Array([1, 2, 3]) }, { data: JSON.stringify({ name: 'CLI token' }) }]);
		expect(posted).toEqual(['https://gateway.example/tx', 'https://gateway.example/tx']);
	});

	it('rejects data-only transactions from the atomic asset entry point', async () => {
		const uploader = new AtomicAssetUploader({
			gateway: 'https://gateway.example',
			fetch: vi.fn(),
			adapter: {
				createTransaction: vi.fn(),
				signTransaction: vi.fn(),
				ownerToAddress: vi.fn(),
			},
		});

		await expect(
			uploader.uploadAtomicAsset(
				{ data: 'not a process', tags: { 'content-type': 'application/json', type: 'Manifest' } },
				owner
			)
		).rejects.toThrow('atomic-asset-tags-invalid');
	});
});
