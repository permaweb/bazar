import { describe, expect, it, vi } from 'vitest';

import type { AssetState } from 'api/asset-marketplace';

import { PROFILE_PICTURE_NOT_OWNED, type ProfilePictureIo, setProfilePictureFromAsset } from './App';

const owner = 'abcdefghijklmnop0123456789ABCDEFGHIJKLMNOPQ';
const other = 'B'.repeat(43);
const assetId = 'A'.repeat(43);
const request = { assetId, image: `https://arweave.net/${assetId}`, owner };

function uniqueState(holder = owner): AssetState {
	return {
		device: 'token@1.0',
		name: 'Art',
		ticker: 'ART',
		denomination: 0,
		totalSupply: '1',
		balances: { [holder]: '1' },
		orders: {},
		swapHeight: 0,
		value: null,
		raw: {},
	};
}

function io(setAvatar: ProfilePictureIo['client']['setAvatar'], holder = owner): ProfilePictureIo {
	return { readState: async () => ({ state: uniqueState(holder) }), client: { setAvatar } };
}

const rejecting = (code: string, phases: Array<'signing' | 'uploading'> = []) =>
	vi.fn<ProfilePictureIo['client']['setAvatar']>(async (_owner, _avatar, options) => {
		for (const phase of phases) options?.onPhase?.(phase);
		throw new Error(code);
	});

describe('setProfilePictureFromAsset', () => {
	it('publishes the picture for the current holder and reports each phase', async () => {
		const setAvatar = vi.fn<ProfilePictureIo['client']['setAvatar']>(async (address, avatar, options) => {
			options?.onPhase?.('signing');
			options?.onPhase?.('uploading');
			return { address, avatar, transactionId: 'T'.repeat(43), handle: '', name: '', bio: '' };
		});
		const phases: string[] = [];

		await expect(
			setProfilePictureFromAsset(request, (phase) => phases.push(phase), io(setAvatar))
		).resolves.toEqual({
			ok: true,
		});
		expect(setAvatar).toHaveBeenCalledWith(owner, request.image, expect.any(Object));
		expect(phases).toEqual(['signing', 'uploading']);
	});

	it('uses profile copy, not trade-recovery copy, when the wallet account changes', async () => {
		for (const phases of [[], ['signing']] as Array<Array<'signing'>>) {
			const outcome = await setProfilePictureFromAsset(
				request,
				() => undefined,
				io(rejecting('wallet-account-changed', phases))
			);
			expect(outcome).toEqual({
				ok: false,
				error: 'The connected wallet changed. Return to your current wallet profile and try again.',
			});
			expect(JSON.stringify(outcome)).not.toContain('transaction saved in this browser');
		}
	});

	it('never shows a raw profile error code', async () => {
		for (const code of ['profile-upload-500', 'profile-index-503', 'wallet-returned-unsigned-transaction']) {
			const outcome = await setProfilePictureFromAsset(request, () => undefined, io(rejecting(code)));
			expect(outcome).toEqual({ ok: false, error: 'Your profile could not be updated. Please try again.' });
		}
		const unsigned = await setProfilePictureFromAsset(
			request,
			() => undefined,
			io(rejecting('wallet-sign-unavailable'))
		);
		expect(unsigned).toEqual({ ok: false, error: 'Connect an Arweave wallet that can sign transactions.' });
	});

	it('says the wallet did not approve when signing is declined', async () => {
		const outcome = await setProfilePictureFromAsset(
			request,
			() => undefined,
			io(rejecting('User rejected the request', ['signing']))
		);
		expect(outcome).toEqual({ ok: false, error: 'Your wallet did not approve the profile.' });
	});

	it('stops before signing when this wallet no longer holds the asset', async () => {
		const setAvatar = rejecting('unreachable');
		const outcome = await setProfilePictureFromAsset(request, () => undefined, io(setAvatar, other));

		expect(outcome).toEqual({ ok: false, error: PROFILE_PICTURE_NOT_OWNED });
		expect(PROFILE_PICTURE_NOT_OWNED).toBe('This wallet no longer owns this unique asset.');
		expect(setAvatar).not.toHaveBeenCalled();
	});

	it('keeps the marketplace copy when the ownership read fails', async () => {
		const setAvatar = rejecting('unreachable');
		const outcome = await setProfilePictureFromAsset(request, () => undefined, {
			readState: async () => {
				throw new Error('asset-state-read-timeout');
			},
			client: { setAvatar },
		});

		expect(outcome).toEqual({
			ok: false,
			error: expect.stringContaining('No transaction was prepared or sent.'),
		});
		expect(setAvatar).not.toHaveBeenCalled();
	});
});
