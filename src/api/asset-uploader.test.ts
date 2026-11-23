import { afterEach, describe, expect, it, vi } from 'vitest';

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

	describe('failure paths', () => {
		afterEach(() => {
			vi.useRealTimers();
		});

		type PostStep = number | Error;

		function failureUploader(
			steps: PostStep[],
			overrides: {
				balance?: string;
				signer?: string;
				signedId?: string;
				activeAddress?: string;
				verified?: boolean;
				onPost?: () => void;
			} = {}
		) {
			const urls: string[] = [];
			const posts: string[] = [];
			const created: Array<Record<string, unknown>> = [];
			const signTransaction = vi.fn(async (held: ReturnType<typeof transaction>) => {
				held.id = overrides.signedId ?? 'S'.repeat(43);
				held.owner = 'signed-owner';
				return held;
			});
			const uploader = new AtomicAssetUploader({
				gateway: 'https://gateway.example',
				fetch: vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
					const url = String(input);
					urls.push(url);
					if (url.includes('/price/')) return new Response('1');
					if (url.includes('/wallet/')) return new Response(overrides.balance ?? '100');
					posts.push(url);
					overrides.onPost?.();
					const step = steps.shift() ?? 200;
					if (step instanceof Error) throw step;
					return new Response('', { status: step });
				}),
				adapter: {
					createTransaction: vi.fn(async (attributes) => {
						created.push(attributes);
						return transaction();
					}),
					signTransaction,
					ownerToAddress: vi.fn(async () => overrides.signer ?? owner),
					...(overrides.activeAddress === undefined
						? {}
						: { getActiveAddress: vi.fn(async () => overrides.activeAddress!) }),
					...(overrides.verified === undefined
						? {}
						: { verifyTransaction: vi.fn(async () => overrides.verified!) }),
				},
			});
			return { uploader, posts, created, signTransaction, urls };
		}

		async function settle<T>(promise: Promise<T>) {
			const outcome = promise.then(
				(value) => ({ value }),
				(error: unknown) => ({ error })
			);
			await vi.runAllTimersAsync();
			return outcome;
		}

		const request = { data: 'payload', tags: { 'content-type': 'text/plain' } };

		it('retries a POST whose connection dropped and resolves once the gateway accepts it', async () => {
			vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
			const { uploader, posts } = failureUploader([new TypeError('Failed to fetch'), 200]);

			const outcome = await settle(uploader.upload(request, owner));

			expect(outcome).toEqual({ value: 'S'.repeat(43) });
			expect(posts).toEqual(['https://gateway.example/tx', 'https://gateway.example/tx']);
		});

		it('reports mint-upload-network after every attempt loses the connection', async () => {
			vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
			const dropped = () => new TypeError('Failed to fetch');
			const { uploader, posts } = failureUploader([dropped(), dropped(), dropped()]);

			const outcome = await settle(uploader.upload(request, owner));

			expect((outcome as { error: Error }).error.message).toBe('mint-upload-network');
			expect(posts).toHaveLength(3);
		});

		it('retries bad statuses and reports the last status when they never clear', async () => {
			vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
			const recovered = failureUploader([503, 503, 200]);
			expect(await settle(recovered.uploader.upload(request, owner))).toEqual({ value: 'S'.repeat(43) });
			expect(recovered.posts).toHaveLength(3);

			const exhausted = failureUploader([503, 503, 503]);
			const outcome = await settle(exhausted.uploader.upload(request, owner));
			expect((outcome as { error: Error }).error.message).toBe('mint-upload-503');
			expect(exhausted.posts).toHaveLength(3);
		});

		it('stops at once when aborted during the retry delay after a dropped connection', async () => {
			vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
			const controller = new AbortController();
			const { uploader, posts } = failureUploader([new TypeError('Failed to fetch'), 200]);

			const pending = uploader.upload(request, owner, { signal: controller.signal }).then(
				(value) => ({ value }),
				(error: unknown) => ({ error })
			);
			await vi.waitFor(() => expect(posts).toHaveLength(1));
			await vi.advanceTimersByTimeAsync(100);
			controller.abort();
			const outcome = await pending;

			expect((outcome as { error: Error }).error.name).toBe('AbortError');
			expect(posts).toHaveLength(1);
			expect(vi.getTimerCount()).toBe(0);
		});

		it('rethrows an aborted POST without retrying it', async () => {
			vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
			const controller = new AbortController();
			const { uploader, posts } = failureUploader([new DOMException('Aborted', 'AbortError'), 200], {
				onPost: () => controller.abort(),
			});

			const outcome = await settle(uploader.upload(request, owner, { signal: controller.signal }));

			expect((outcome as { error: Error }).error.name).toBe('AbortError');
			expect(posts).toHaveLength(1);
		});

		it('refuses to post when the wallet signed with a different account', async () => {
			const { uploader, posts } = failureUploader([], { signer: 'X'.repeat(43) });
			const onTransaction = vi.fn();

			await expect(uploader.upload(request, owner, { onTransaction })).rejects.toThrow('wallet-account-changed');
			expect(posts).toHaveLength(0);
			expect(onTransaction).not.toHaveBeenCalled();
		});

		it('refuses to price or sign once the wallet has switched to another account', async () => {
			const { uploader, urls, signTransaction } = failureUploader([], { activeAddress: 'X'.repeat(43) });

			await expect(uploader.upload(request, owner)).rejects.toThrow('wallet-account-changed');
			expect(urls).toEqual([]);
			expect(signTransaction).not.toHaveBeenCalled();
		});

		it('refuses to post when the wallet signature does not verify', async () => {
			const { uploader, posts } = failureUploader([], { verified: false });
			const onTransaction = vi.fn();

			await expect(uploader.upload(request, owner, { onTransaction })).rejects.toThrow(
				'wallet-returned-invalid-signature'
			);
			expect(posts).toHaveLength(0);
			expect(onTransaction).not.toHaveBeenCalled();
		});

		it('refuses to post when the wallet returns an unsigned transaction', async () => {
			const { uploader, posts } = failureUploader([], { signedId: '' });

			await expect(uploader.upload(request, owner)).rejects.toThrow('wallet-returned-unsigned-transaction');
			expect(posts).toHaveLength(0);
		});

		it('does not ask the wallet to sign when the balance cannot cover the upload', async () => {
			const { uploader, posts, signTransaction } = failureUploader([], { balance: '0' });

			await expect(uploader.upload(request, owner)).rejects.toThrow('mint-insufficient-balance');
			expect(signTransaction).not.toHaveBeenCalled();
			expect(posts).toHaveLength(0);
		});

		it('creates target uploads as a one-unit transfer to the target', async () => {
			const target = 'T'.repeat(43);
			const { uploader, created } = failureUploader([200]);

			await uploader.upload({ ...request, target }, owner);

			expect(created).toEqual([{ data: 'payload', target, quantity: '1' }]);
		});
	});
});
