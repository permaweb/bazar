import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
	ACCOUNT_PROFILE_PROTOCOL,
	PROFILE_REQUEST_TIMEOUT_MS,
	profileAvatarUrl,
	ProfileClient,
	profileDisplayName,
	readAccountProfile,
} from './profile';

const address = 'A'.repeat(43);
const profileId = 'P'.repeat(43);
const avatarId = 'V'.repeat(43);

beforeEach(() => {
	vi.restoreAllMocks();
});

afterEach(() => {
	vi.useRealTimers();
});

describe('Account-0.3 profiles', () => {
	it('reads the latest owner-signed profile and resolves its permanent avatar', async () => {
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce(Response.json({ data: { transactions: { edges: [{ node: { id: profileId } }] } } }))
			.mockResolvedValueOnce(
				Response.json({
					handle: 'captain',
					name: 'Captain Agent',
					bio: 'Ships code.',
					avatar: `ar://${avatarId}`,
				})
			);

		const profile = await readAccountProfile(address, {
			fetch: fetcher as typeof fetch,
			gateway: 'https://gateway.example',
		});

		expect(profile).toMatchObject({ address, transactionId: profileId, handle: 'captain' });
		expect(profileDisplayName(profile)).toBe('captain');
		expect(profileAvatarUrl(profile, 'https://gateway.example')).toBe(`https://gateway.example/${avatarId}`);
		expect(fetcher.mock.calls[0][0]).toBe('https://arweave.net/graphql');
		expect(fetcher.mock.calls[1][0]).toBe(`https://gateway.example/${profileId}`);
		const graphql = JSON.parse(String(fetcher.mock.calls[0][1]?.body));
		expect(graphql.variables).toEqual({ owners: [address] });
		expect(graphql.query).toContain('Protocol-Name');
		expect(graphql.query).toContain(ACCOUNT_PROFILE_PROTOCOL);
	});

	it('deduplicates concurrent reads for one address', async () => {
		const other = 'B'.repeat(43);
		const fetcher = vi.fn(async () => Response.json({ data: { transactions: { edges: [] } } }));

		await Promise.all([
			readAccountProfile(other, { fetch: fetcher as typeof fetch, gateway: 'https://gateway.example' }),
			readAccountProfile(other, { fetch: fetcher as typeof fetch, gateway: 'https://gateway.example' }),
		]);

		expect(fetcher).toHaveBeenCalledTimes(1);
	});

	it('sets a unique asset as the avatar while preserving profile details', async () => {
		const owner = 'C'.repeat(43);
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce(Response.json({ data: { transactions: { edges: [{ node: { id: profileId } }] } } }))
			.mockResolvedValueOnce(
				Response.json({ handle: 'holder', name: 'Token Holder', bio: 'Collects.', avatar: '' })
			);
		const publish = vi.fn(async (_data: string | Uint8Array) => 'T'.repeat(43));
		const client = new ProfileClient({
			fetch: fetcher as typeof fetch,
			gateway: 'https://gateway.example',
			publish,
		});

		const profile = await client.setAvatar(owner, avatarId);

		expect(profile.avatar).toBe(`ar://${avatarId}`);
		expect(publish).toHaveBeenCalledWith(
			JSON.stringify({
				handle: 'holder',
				name: 'Token Holder',
				bio: 'Collects.',
				avatar: `ar://${avatarId}`,
			}),
			expect.arrayContaining([
				{ name: 'Content-Type', value: 'application/json' },
				{ name: 'Protocol-Name', value: ACCOUNT_PROFILE_PROTOCOL },
			]),
			owner,
			{}
		);
	});

	it('updates the display name without changing the avatar', async () => {
		const owner = 'F'.repeat(43);
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce(Response.json({ data: { transactions: { edges: [{ node: { id: profileId } }] } } }))
			.mockResolvedValueOnce(
				Response.json({
					handle: 'old-name',
					name: 'Full Name',
					bio: 'Still here.',
					avatar: `ar://${avatarId}`,
				})
			);
		const publish = vi.fn(async (_data: string | Uint8Array) => 'T'.repeat(43));
		const client = new ProfileClient({
			fetch: fetcher as typeof fetch,
			gateway: 'https://gateway.example',
			publish,
		});

		const profile = await client.update(owner, { displayName: 'New name' });

		expect(profile).toMatchObject({
			handle: 'New name',
			name: 'Full Name',
			bio: 'Still here.',
			avatar: `ar://${avatarId}`,
		});
		expect(JSON.parse(String(publish.mock.calls[0][0]))).toMatchObject({
			handle: 'New name',
			name: 'Full Name',
			bio: 'Still here.',
			avatar: `ar://${avatarId}`,
		});
	});

	it('updates the avatar without requiring a display name change', async () => {
		const owner = 'H'.repeat(43);
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce(Response.json({ data: { transactions: { edges: [{ node: { id: profileId } }] } } }))
			.mockResolvedValueOnce(
				Response.json({ handle: 'Keep this name', name: '', bio: 'Still here.', avatar: '' })
			);
		const client = new ProfileClient({
			fetch: fetcher as typeof fetch,
			gateway: 'https://gateway.example',
			publish: vi.fn(async () => 'T'.repeat(43)),
		});

		const profile = await client.update(owner, { avatar: avatarId });

		expect(profile).toMatchObject({
			handle: 'Keep this name',
			bio: 'Still here.',
			avatar: `ar://${avatarId}`,
		});
	});

	it('uploads a dropped profile image as a permanent avatar transaction', async () => {
		const owner = 'G'.repeat(43);
		const publish = vi.fn(async () => avatarId);
		const client = new ProfileClient({ publish });
		const data = new Uint8Array([1, 2, 3]);

		await expect(client.uploadAvatar(owner, data, 'image/webp')).resolves.toBe(avatarId);
		expect(publish).toHaveBeenCalledWith(
			data,
			expect.arrayContaining([
				{ name: 'Content-Type', value: 'image/webp' },
				{ name: 'Type', value: 'Profile-Avatar' },
			]),
			owner,
			{}
		);
	});

	it('rejects unsupported or oversized profile images before publishing', async () => {
		const publish = vi.fn(async () => avatarId);
		const client = new ProfileClient({ publish });

		await expect(client.uploadAvatar(address, new Uint8Array([1]), 'image/svg+xml')).rejects.toThrow(
			'invalid-profile-avatar-type'
		);
		await expect(client.uploadAvatar(address, new Uint8Array(), 'image/png')).rejects.toThrow(
			'invalid-profile-avatar-size'
		);
		expect(publish).not.toHaveBeenCalled();
	});

	it('rejects malformed wallet and avatar identifiers before network access', async () => {
		await expect(readAccountProfile('not-an-address')).rejects.toThrow('invalid-profile-address');
		const client = new ProfileClient({ publish: vi.fn() });
		await expect(client.setAvatar(address, 'not-an-asset')).rejects.toThrow('invalid-profile-avatar');
		await expect(client.update(address, {})).rejects.toThrow('empty-profile-update');
	});

	it('keeps an asset image URL when setting it as the profile picture', async () => {
		const owner = 'D'.repeat(43);
		const publish = vi.fn(async (_data: string | Uint8Array) => 'T'.repeat(43));
		const client = new ProfileClient({
			fetch: vi.fn(async () => Response.json({ data: { transactions: { edges: [] } } })) as typeof fetch,
			gateway: 'https://gateway.example',
			publish,
		});

		await client.setAvatar(owner, `https://arweave.net/${avatarId}`);

		expect(JSON.parse(String(publish.mock.calls[0][0]))).toMatchObject({
			avatar: `https://arweave.net/${avatarId}`,
		});
	});

	it('publishes the exact case-sensitive Account-0.3 tag contract', async () => {
		const owner = 'E'.repeat(43);
		const tags: Array<{ name: string; value: string }> = [];
		const transaction = {
			id: 'T'.repeat(43),
			owner: 'signed-owner',
			addTag: (name: string, value: string) => tags.push({ name, value }),
			toJSON: () => ({ owner: 'signed-owner', tags }),
		};
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce(Response.json({ data: { transactions: { edges: [] } } }))
			.mockResolvedValueOnce(new Response('', { status: 202 }));
		const wallet = {
			getActiveAddress: vi.fn(async () => owner),
			sign: vi.fn(async () => transaction),
		} as unknown as Window['arweaveWallet'];
		const client = new ProfileClient({
			arweave: {
				createTransaction: vi.fn(async () => transaction),
				wallets: { ownerToAddress: vi.fn(async () => owner) },
			},
			fetch: fetcher as typeof fetch,
			gateway: 'https://gateway.example',
			wallet,
		});

		await client.setAvatar(owner, avatarId);

		expect(tags).toContainEqual({ name: 'Protocol-Name', value: ACCOUNT_PROFILE_PROTOCOL });
		expect(tags).not.toContainEqual({ name: 'protocol-name', value: ACCOUNT_PROFILE_PROTOCOL });
		expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body))).toMatchObject({ id: transaction.id });
	});

	it('rejects a hung profile index lookup within its deadline on every endpoint', async () => {
		vi.useFakeTimers();
		const owner = 'hung-index'.padEnd(43, 'H');
		const fetcher = vi.fn(
			(_input: RequestInfo | URL, _init?: RequestInit) => new Promise<Response>(() => undefined)
		);
		const read = readAccountProfile(owner, {
			fetch: fetcher as typeof fetch,
			gateway: 'https://gateway.example',
			requestTimeoutMs: 1_000,
		});
		const rejection = expect(read).rejects.toThrow('profile-index-timeout');

		// The preferred index times out at 1 s, which starts the fallback with its own 1 s.
		await vi.advanceTimersByTimeAsync(2_000);
		await rejection;
		expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
			'https://arweave.net/graphql',
			'https://ardrive.net/graphql',
		]);
		expect(vi.getTimerCount()).toBe(0);
	});

	it('rejects a hung profile data read within its deadline', async () => {
		vi.useFakeTimers();
		const owner = 'hung-data'.padEnd(43, 'J');
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce(Response.json({ data: { transactions: { edges: [{ node: { id: profileId } }] } } }))
			.mockImplementationOnce(() => new Promise<Response>(() => undefined));
		const read = readAccountProfile(owner, { fetch: fetcher as typeof fetch, gateway: 'https://gateway.example' });
		const rejection = expect(read).rejects.toThrow('profile-data-timeout');

		await vi.advanceTimersByTimeAsync(PROFILE_REQUEST_TIMEOUT_MS);
		await rejection;
		expect(fetcher.mock.calls[1][0]).toBe(`https://gateway.example/${profileId}`);
		expect(vi.getTimerCount()).toBe(0);
	});

	it('frees a shared read slot when a hung profile read hits its deadline', async () => {
		vi.useFakeTimers();
		const hung = Array.from({ length: 6 }, (_, index) => index.toString(36).padStart(43, 'K'));
		const queued = 'queued-read'.padEnd(43, 'L');
		const hangingFetch = vi.fn(() => new Promise<Response>(() => undefined));
		const answeringFetch = vi.fn(async () => Response.json({ data: { transactions: { edges: [] } } }));
		const stalled = hung.map((owner) =>
			readAccountProfile(owner, {
				fetch: hangingFetch as typeof fetch,
				gateway: 'https://gateway.example',
				requestTimeoutMs: 500,
			}).catch((error: Error) => error.message)
		);
		const next = readAccountProfile(queued, { fetch: answeringFetch as typeof fetch });

		await vi.advanceTimersByTimeAsync(0);
		expect(answeringFetch).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1_000);

		await expect(Promise.all(stalled)).resolves.toEqual(hung.map(() => 'profile-index-timeout'));
		await expect(next).resolves.toBeNull();
		expect(answeringFetch).toHaveBeenCalledTimes(1);
	});

	describe('index choice', () => {
		const primaryIndex = 'https://arweave.net/graphql';
		const fallbackIndex = 'https://ardrive.net/graphql';
		const profileEdges = { data: { transactions: { edges: [{ node: { id: profileId } }] } } };
		const noEdges = { data: { transactions: { edges: [] } } };
		const storedProfile = { handle: 'old-name', name: 'Full Name', bio: 'Still here.', avatar: `ar://${avatarId}` };

		function routedFetch(routes: Record<string, { delayMs?: number; respond: () => Response }>) {
			return vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
				const route = routes[String(input)];
				if (!route) return Promise.reject(new Error(`unexpected-${String(input)}`));
				return new Promise<Response>((resolve, reject) => {
					const timer = setTimeout(() => resolve(route.respond()), route.delayMs ?? 0);
					init?.signal?.addEventListener('abort', () => {
						clearTimeout(timer);
						reject(init.signal?.reason);
					});
				});
			});
		}

		it('rebuilds an update from the preferred index even when a fallback would answer faster with nothing', async () => {
			vi.useFakeTimers();
			const owner = 'slow-primary'.padEnd(43, 'M');
			const fetcher = routedFetch({
				[primaryIndex]: { delayMs: 3_000, respond: () => Response.json(profileEdges) },
				[fallbackIndex]: { delayMs: 150, respond: () => Response.json(noEdges) },
				[`https://gateway.example/${profileId}`]: { respond: () => Response.json(storedProfile) },
			});
			const publish = vi.fn(async (_data: string | Uint8Array) => 'T'.repeat(43));
			const client = new ProfileClient({
				fetch: fetcher as typeof fetch,
				gateway: 'https://gateway.example',
				publish,
			});

			const update = client.update(owner, { displayName: 'New name' });
			await vi.advanceTimersByTimeAsync(2_999);
			expect(publish).not.toHaveBeenCalled();
			await vi.advanceTimersByTimeAsync(1);
			await vi.advanceTimersByTimeAsync(1);

			await expect(update).resolves.toMatchObject({ handle: 'New name', name: 'Full Name', bio: 'Still here.' });
			expect(JSON.parse(String(publish.mock.calls[0][0]))).toEqual({
				handle: 'New name',
				name: 'Full Name',
				bio: 'Still here.',
				avatar: `ar://${avatarId}`,
			});
			expect(fetcher.mock.calls.map(([url]) => url)).not.toContain(fallbackIndex);
		});

		it.each([
			['a rate-limited preferred index', () => new Response('busy', { status: 429 }), 'profile-index-429'],
			[
				'a preferred index answer without data',
				() => Response.json({ errors: [{ message: 'overloaded' }] }),
				'profile-index-invalid',
			],
		])('fails closed instead of publishing from %s', async (_label, respond, error) => {
			const owner = 'closed-write'.padEnd(43, 'N');
			const fetcher = routedFetch({
				[primaryIndex]: { respond },
				[fallbackIndex]: { respond: () => Response.json(noEdges) },
			});
			const publish = vi.fn(async (_data: string | Uint8Array) => 'T'.repeat(43));
			const client = new ProfileClient({
				fetch: fetcher as typeof fetch,
				gateway: 'https://gateway.example',
				publish,
			});

			await expect(client.update(owner, { displayName: 'New name' })).rejects.toThrow(error);
			await expect(client.setAvatar(owner, avatarId)).rejects.toThrow(error);
			expect(publish).not.toHaveBeenCalled();
			expect(fetcher.mock.calls.map(([url]) => url)).toEqual([primaryIndex, primaryIndex]);
		});

		it('shows a fallback answer when the preferred index fails but asks the preferred index again next time', async () => {
			const owner = 'fallback-read'.padEnd(43, 'Q');
			let primaryUp = false;
			const fetcher = routedFetch({
				[primaryIndex]: {
					respond: () => (primaryUp ? Response.json(profileEdges) : new Response('down', { status: 503 })),
				},
				[fallbackIndex]: { respond: () => Response.json(noEdges) },
				[`https://gateway.example/${profileId}`]: { respond: () => Response.json(storedProfile) },
			});
			const options = { fetch: fetcher as typeof fetch, gateway: 'https://gateway.example' };

			await expect(readAccountProfile(owner, options)).resolves.toBeNull();
			primaryUp = true;
			await expect(readAccountProfile(owner, options)).resolves.toMatchObject({ handle: 'old-name' });
			await expect(readAccountProfile(owner, options)).resolves.toMatchObject({ handle: 'old-name' });
			expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
				primaryIndex,
				fallbackIndex,
				primaryIndex,
				`https://gateway.example/${profileId}`,
			]);
		});
	});
});
