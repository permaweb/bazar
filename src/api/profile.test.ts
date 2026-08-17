import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
	ACCOUNT_PROFILE_PROTOCOL,
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
});
