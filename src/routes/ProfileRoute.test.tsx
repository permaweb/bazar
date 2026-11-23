import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { ProfileClient } from 'api/profile';

import { ProfileSaveError, profileUpdateError } from 'components/ProfileIdentity';

import {
	PROFILE_PICTURE_REUSED_STATUS,
	type ProfileEditUpdate,
	ProfilePage,
	saveProfileEdit,
	type UploadedProfileAvatar,
} from './ProfileRoute';

const profile = {
	address: 'abcdefghijklmno0123456789ABCDEFGHIJKLMNOPQ',
	avatar: 'https://arweave.net/avatar',
	bio: 'Building permanent things.',
	displayName: 'Alice on Arweave',
};

describe('ProfileRoute', () => {
	it('renders profile detail, action, and route content', () => {
		const markup = renderToStaticMarkup(
			<ProfilePage action={<button>Edit profile</button>} profile={profile}>
				<p>Owned assets</p>
			</ProfilePage>
		);

		expect(markup).toContain('Alice on Arweave');
		expect(markup).toContain(profile.address);
		expect(markup).toContain('Building permanent things.');
		expect(markup).toContain('Edit profile');
		expect(markup).toContain('Owned assets');
	});

	it('announces loading and exposes retry on failure', () => {
		const markup = renderToStaticMarkup(
			<ProfilePage error="Profile could not be resolved." isLoading onRetry={() => undefined} profile={profile} />
		);

		expect(markup).toContain('Resolving this profile from Arweave');
		expect(markup).toContain('role="alert"');
		expect(markup).toContain('Retry');
	});

	it('makes both the avatar and name edit control available to the owner', () => {
		const markup = renderToStaticMarkup(<ProfilePage onEdit={() => undefined} profile={profile} />);

		expect(markup).toContain('aria-label="Edit profile picture"');
		expect(markup).toContain('aria-label="Edit profile"');
	});
});

describe('saveProfileEdit', () => {
	const owner = 'O'.repeat(43);
	const otherOwner = 'Q'.repeat(43);
	const firstAvatar = 'V'.repeat(43);
	const secondAvatar = 'W'.repeat(43);
	const profileTx = 'T'.repeat(43);
	const picture = () => new File([new Uint8Array([1, 2, 3])], 'me.png', { type: 'image/png' });
	const edit = (avatarFile: File | null): ProfileEditUpdate => ({
		displayName: 'Alice',
		displayNameChanged: true,
		avatarFile,
		removeAvatar: false,
	});

	type Step = 'ok' | 'reject-sign' | 'post-fail';
	/** A ProfileClient whose publishes follow `steps`; avatar uploads return the queued ids. */
	function harness(steps: Step[], avatars: string[] = [firstAvatar, secondAvatar]) {
		const queue = [...steps];
		const ids = [...avatars];
		const publish = vi.fn(
			async (
				_data: string | Uint8Array,
				tags: ReadonlyArray<{ name: string; value: string }>,
				_owner: string,
				options: { onPhase?(phase: 'signing' | 'uploading'): void }
			) => {
				const step = queue.shift() ?? 'ok';
				options.onPhase?.('signing');
				if (step === 'reject-sign') throw new Error('User rejected the signature');
				options.onPhase?.('uploading');
				if (step === 'post-fail') throw new Error('profile-upload-500');
				return tags.some((tag) => tag.value === 'Profile-Avatar') ? ids.shift()! : profileTx;
			}
		);
		const fetcher = vi.fn(async () => Response.json({ data: { transactions: { edges: [] } } }));
		const client = new ProfileClient({
			fetch: fetcher as typeof fetch,
			gateway: 'https://gateway.example',
			publish,
		});
		const update = vi.spyOn(client, 'update');
		const uploadAvatar = vi.spyOn(client, 'uploadAvatar');
		return { client, publish, update, uploadAvatar };
	}

	it('reuses the uploaded picture when the profile publish failed, without a second picture approval', async () => {
		const { client, publish, update, uploadAvatar } = harness(['ok', 'reject-sign', 'ok']);
		const uploaded: { current: UploadedProfileAvatar | null } = { current: null };
		const file = picture();
		const firstStatuses: string[] = [];

		const failure = await saveProfileEdit(client, owner, edit(file), uploaded, (s) => firstStatuses.push(s)).catch(
			(cause: unknown) => cause
		);
		expect(failure).toBeInstanceOf(ProfileSaveError);
		expect(failure).toMatchObject({ stage: 'profile-signing', pictureUploaded: true });
		expect(uploaded.current).toEqual({ address: owner, file, avatar: firstAvatar });
		expect(firstStatuses).toEqual([
			'Approve picture…',
			'Uploading picture…',
			'Preparing profile…',
			'Approve profile…',
		]);
		expect(profileUpdateError(failure)).toBe(
			'Your wallet did not approve the profile. Your picture was uploaded, but your profile was not published. Save again to finish. Only one approval is needed.'
		);

		const retryStatuses: string[] = [];
		const saved = await saveProfileEdit(client, owner, edit(file), uploaded, (s) => retryStatuses.push(s));

		expect(uploadAvatar).toHaveBeenCalledTimes(1);
		expect(publish).toHaveBeenCalledTimes(3);
		expect(update).toHaveBeenCalledTimes(2);
		expect(update.mock.calls[1][1]).toEqual({ displayName: 'Alice', avatar: firstAvatar });
		expect(JSON.parse(String(publish.mock.calls[2][0]))).toMatchObject({ avatar: `ar://${firstAvatar}` });
		expect(retryStatuses[0]).toBe(PROFILE_PICTURE_REUSED_STATUS);
		expect(retryStatuses).not.toContain('Approve picture…');
		expect(retryStatuses).not.toContain('Uploading picture…');
		expect(saved).toMatchObject({ address: owner, transactionId: profileTx, avatar: `ar://${firstAvatar}` });
		expect(uploaded.current).toBeNull();
	});

	it('uploads again for a different File object, even with identical bytes', async () => {
		const { client, uploadAvatar, update } = harness(['ok', 'post-fail', 'ok', 'ok']);
		const uploaded: { current: UploadedProfileAvatar | null } = { current: null };

		await expect(saveProfileEdit(client, owner, edit(picture()), uploaded, () => undefined)).rejects.toMatchObject({
			stage: 'profile-publishing',
			pictureUploaded: true,
		});
		await saveProfileEdit(client, owner, edit(picture()), uploaded, () => undefined);

		expect(uploadAvatar).toHaveBeenCalledTimes(2);
		expect(update.mock.calls[1][1].avatar).toBe(secondAvatar);
	});

	it('never reuses a picture uploaded for another address', async () => {
		const { client, uploadAvatar, update } = harness(['ok', 'post-fail', 'ok', 'ok']);
		const uploaded: { current: UploadedProfileAvatar | null } = { current: null };
		const file = picture();

		await expect(saveProfileEdit(client, owner, edit(file), uploaded, () => undefined)).rejects.toBeInstanceOf(
			ProfileSaveError
		);
		await saveProfileEdit(client, otherOwner, edit(file), uploaded, () => undefined);

		expect(uploadAvatar).toHaveBeenCalledTimes(2);
		expect(uploadAvatar.mock.calls[1][0]).toBe(otherOwner);
		expect(update.mock.calls[1][1].avatar).toBe(secondAvatar);
	});

	it('keeps nothing when the picture itself was not accepted, so the retry uploads it', async () => {
		const { client, uploadAvatar } = harness(['post-fail', 'ok', 'ok']);
		const uploaded: { current: UploadedProfileAvatar | null } = { current: null };
		const file = picture();

		const failure = await saveProfileEdit(client, owner, edit(file), uploaded, () => undefined).catch(
			(cause: unknown) => cause
		);
		expect(failure).toMatchObject({ stage: 'picture-uploading', pictureUploaded: false });
		expect(uploaded.current).toBeNull();
		expect(profileUpdateError(failure)).toBe('Your profile could not be updated. Please try again.');

		await saveProfileEdit(client, owner, edit(file), uploaded, () => undefined);
		expect(uploadAvatar).toHaveBeenCalledTimes(2);
	});

	it('drops a kept picture once the picture is removed', async () => {
		const { client, update } = harness(['ok', 'post-fail', 'ok']);
		const uploaded: { current: UploadedProfileAvatar | null } = { current: null };

		await expect(saveProfileEdit(client, owner, edit(picture()), uploaded, () => undefined)).rejects.toBeInstanceOf(
			ProfileSaveError
		);
		await saveProfileEdit(client, owner, { ...edit(null), removeAvatar: true }, uploaded, () => undefined);

		expect(uploaded.current).toBeNull();
		expect(update.mock.calls[1][1]).toEqual({ displayName: 'Alice', avatar: '' });
	});

	it('names the failing step in the error copy', () => {
		expect(
			profileUpdateError(new ProfileSaveError('picture-preparing', false, new Error('wallet-sign-unavailable')))
		).toBe('Connect an Arweave wallet that can sign transactions.');
		expect(profileUpdateError(new ProfileSaveError('picture-signing', false, new Error('declined')))).toBe(
			'Your wallet did not approve the picture, so nothing was uploaded.'
		);
		expect(
			profileUpdateError(new ProfileSaveError('profile-preparing', true, new Error('profile-index-500')))
		).toBe(
			'Your picture was uploaded, but your profile was not published. Save again to finish. Only one approval is needed.'
		);
		expect(
			profileUpdateError(new ProfileSaveError('profile-signing', true, new Error('wallet-account-changed')))
		).toBe(
			'The connected wallet changed. Return to your current wallet profile and try again. Your picture was uploaded, but your profile was not published. Save again to finish. Only one approval is needed.'
		);
		expect(
			profileUpdateError(new ProfileSaveError('profile-publishing', false, new Error('profile-upload-500')))
		).toBe('Your profile could not be updated. Please try again.');
		expect(profileUpdateError(new Error('invalid-profile-avatar-size'))).toBe(
			'Choose an image smaller than 10 MB.'
		);
	});
});
