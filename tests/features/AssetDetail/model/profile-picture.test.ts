import { describe, expect, it } from 'vitest';

import type { AssetState } from 'api/marketplace';

import {
	INITIAL_PROFILE_PICTURE_UPDATE,
	type ProfilePictureEvent,
	profilePictureOwnershipConfirmed,
	type ProfilePictureUpdate,
	profilePictureUpdateKey,
	profilePictureUpdateReducer,
	profilePictureUpdateView,
} from 'features/AssetDetail/model/profile-picture';
import { appError } from 'helpers/app-error';

const assetId = 'A'.repeat(43);
const owner = 'W'.repeat(43);
const image = `https://arweave.net/${assetId}`;
const key = profilePictureUpdateKey(assetId, owner, image);

function reduce(update: ProfilePictureUpdate, ...events: ProfilePictureEvent[]): ProfilePictureUpdate {
	return events.reduce(profilePictureUpdateReducer, update);
}

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

describe('profile picture update', () => {
	it('walks from the ownership check through signing to a published profile', () => {
		const done = reduce(
			INITIAL_PROFILE_PICTURE_UPDATE,
			{ type: 'started', key },
			{ type: 'phase', key, phase: 'signing' },
			{ type: 'phase', key, phase: 'uploading' },
			{ type: 'succeeded', key }
		);
		expect(done).toEqual({ key, status: 'done', error: null });
		expect(profilePictureUpdateView(done, key)).toEqual({ status: 'done', error: null });
	});

	it('returns to idle with the failure and clears it on the next attempt', () => {
		const failed = reduce(
			INITIAL_PROFILE_PICTURE_UPDATE,
			{ type: 'started', key },
			{ type: 'failed', key, error: appError('profile-avatar-not-owned') }
		);
		expect(failed).toMatchObject({ status: 'idle' });
		expect(failed.error?.reason).toBe('profile-avatar-not-owned');
		expect(reduce(failed, { type: 'started', key })).toEqual({ key, status: 'checking', error: null });
	});

	it('ignores progress that no longer belongs to the update in flight', () => {
		const checking = reduce(INITIAL_PROFILE_PICTURE_UPDATE, { type: 'started', key });
		const otherKey = profilePictureUpdateKey('B'.repeat(43), owner, image);
		expect(reduce(checking, { type: 'phase', key: otherKey, phase: 'signing' })).toBe(checking);
		expect(reduce(checking, { type: 'succeeded', key: otherKey })).toBe(checking);
		const done = reduce(checking, { type: 'succeeded', key });
		expect(reduce(done, { type: 'phase', key, phase: 'uploading' })).toBe(done);
	});

	it('shows nothing for another asset, wallet, or image', () => {
		const done = reduce(INITIAL_PROFILE_PICTURE_UPDATE, { type: 'started', key }, { type: 'succeeded', key });
		expect(profilePictureUpdateView(done, profilePictureUpdateKey('B'.repeat(43), owner, image))).toEqual({
			status: 'idle',
			error: null,
		});
		expect(profilePictureUpdateView(done, profilePictureUpdateKey(assetId, 'X'.repeat(43), image))).toEqual({
			status: 'idle',
			error: null,
		});
		expect(profilePictureUpdateView(done, profilePictureUpdateKey(assetId, owner, 'other'))).toEqual({
			status: 'idle',
			error: null,
		});
	});

	it('confirms ownership only for a unique asset this wallet holds', () => {
		expect(profilePictureOwnershipConfirmed(assetState(), owner)).toBe(true);
		expect(profilePictureOwnershipConfirmed(assetState(), 'X'.repeat(43))).toBe(false);
		expect(profilePictureOwnershipConfirmed(assetState({ totalSupply: '1000' }), owner)).toBe(false);
		expect(profilePictureOwnershipConfirmed(assetState({ denomination: 12 }), owner)).toBe(false);
	});
});
