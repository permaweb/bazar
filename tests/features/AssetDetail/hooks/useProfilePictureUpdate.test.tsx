// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AssetState } from 'api/marketplace';

import { useProfilePictureUpdate } from 'features/AssetDetail/hooks/useProfilePictureUpdate';

import { renderHook, settle } from './render-hook';

const assetId = 'A'.repeat(43);
const owner = 'W'.repeat(43);
const image = `https://arweave.net/${assetId}`;

const readAssetStateWithDeadline = vi.fn();
const setAvatar = vi.fn();

vi.mock('api/marketplace', async (importOriginal) => ({
	...(await importOriginal<typeof import('api/marketplace')>()),
	readAssetStateWithDeadline: (processId: string, options: unknown) => readAssetStateWithDeadline(processId, options),
}));

vi.mock('api/profile', async (importOriginal) => ({
	...(await importOriginal<typeof import('api/profile')>()),
	ProfileClient: class {
		setAvatar(avatarOwner: string, avatarImage: string, options: { onPhase?: (phase: string) => void }) {
			return setAvatar(avatarOwner, avatarImage, options);
		}
	},
}));

function assetState(overrides: Partial<AssetState> = {}): AssetState {
	return {
		device: 'token@1.0',
		name: 'AntiqueWhite',
		ticker: 'ASSET',
		denomination: 0,
		totalSupply: '1',
		balances: { [owner]: '1' },
		orders: {},
		swapHeight: 1,
		value: null,
		raw: {},
		...overrides,
	};
}

beforeEach(() => {
	readAssetStateWithDeadline.mockReset().mockResolvedValue({ state: assetState(), provider: 'peer' });
	setAvatar.mockReset().mockResolvedValue({});
});

afterEach(() => vi.restoreAllMocks());

describe('profile picture update', () => {
	it('checks live ownership, then signs and publishes the profile', async () => {
		const harness = renderHook(useProfilePictureUpdate, { assetId, owner, image });
		expect(harness.current().status).toBe('idle');
		setAvatar.mockImplementation(async (_owner, _image, options: { onPhase?: (phase: string) => void }) => {
			options.onPhase?.('signing');
			options.onPhase?.('uploading');
			return {};
		});
		await React.act(async () => {
			await harness.current().apply();
		});
		expect(readAssetStateWithDeadline).toHaveBeenCalledWith(assetId, { maxAge: 0 });
		expect(setAvatar).toHaveBeenCalledWith(owner, image, expect.anything());
		expect(harness.current()).toMatchObject({ status: 'done', error: null });
		harness.unmount();
	});

	it('refuses to publish an asset the wallet no longer owns', async () => {
		readAssetStateWithDeadline.mockResolvedValue({
			state: assetState({ balances: { ['X'.repeat(43)]: '1' } }),
			provider: 'peer',
		});
		const harness = renderHook(useProfilePictureUpdate, { assetId, owner, image });
		await React.act(async () => {
			await harness.current().apply();
		});
		expect(setAvatar).not.toHaveBeenCalled();
		expect(harness.current().status).toBe('idle');
		expect(harness.current().error).toContain('wallet');
		harness.unmount();
	});

	it('reports a failed publish and keeps the button usable', async () => {
		setAvatar.mockRejectedValue(new Error('upload failed'));
		const harness = renderHook(useProfilePictureUpdate, { assetId, owner, image });
		await React.act(async () => {
			await harness.current().apply();
		});
		expect(harness.current().status).toBe('idle');
		expect(harness.current().error).toBeTruthy();
		harness.unmount();
	});

	it('does not carry a finished update over to the next asset', async () => {
		const harness = renderHook(useProfilePictureUpdate, { assetId, owner, image });
		await React.act(async () => {
			await harness.current().apply();
		});
		expect(harness.current().status).toBe('done');
		harness.rerender({ assetId: 'B'.repeat(43), owner, image });
		await settle();
		expect(harness.current()).toMatchObject({ status: 'idle', error: null });
		harness.unmount();
	});
});
