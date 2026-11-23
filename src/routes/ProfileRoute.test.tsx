import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ProfileClient } from 'api/profile';

import { ProfileSaveError, profileUpdateError } from 'components/ProfileIdentity';

vi.mock('../app/useDialogFocus', () => ({ useDialogFocus: () => ({ current: null }) }));
vi.mock('./MyAssetsRoute', () => ({ default: () => null }));
const wallet = vi.hoisted(() => ({ address: 'abcdefghijklmno0123456789ABCDEFGHIJKLMNOPQ' as string | null }));
vi.mock('providers/WalletProvider', () => ({ useWallet: () => wallet }));

import ProfileRoute, {
	INVALID_PROFILE_ADDRESS,
	PROFILE_PICTURE_REUSED_STATUS,
	ProfileEditDialog,
	type ProfileEditUpdate,
	profileLoadView,
	ProfilePage,
	ProfileStatusAnnouncement,
	saveProfileEdit,
	type UploadedProfileAvatar,
} from './ProfileRoute';

const profile = {
	address: 'abcdefghijklmno0123456789ABCDEFGHIJKLMNOPQ',
	avatar: 'https://arweave.net/avatar',
	bio: 'Building permanent things.',
	displayName: 'Alice on Arweave',
};

const STATUS_REGION = /<p aria-live="polite" class="sr-only" role="status">([^<]*)<\/p>/g;

function statusRegions(markup: string) {
	return [...markup.matchAll(STATUS_REGION)].map((match) => match[1]);
}

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

describe('profile editor initial focus', () => {
	it('marks the name field, not the header Close button, as the dialog initial focus target', () => {
		// React 18 never writes `autofocus` on a client render, so useDialogFocus
		// only finds the field through data-dialog-initial; without it, focus
		// falls to the first focusable element, "Close profile editor".
		const markup = renderToStaticMarkup(
			<ProfileEditDialog
				onClose={() => undefined}
				onSave={async () => undefined}
				open
				ownerConnected
				profile={profile}
				restoreTarget={() => null}
			/>
		);
		const initialTargets = markup.match(/<[a-z]+\b[^>]*\bdata-dialog-initial\b[^>]*>/g) ?? [];

		expect(initialTargets).toHaveLength(1);
		expect(initialTargets[0]).toMatch(/^<input\b/);
		expect(initialTargets[0]).toContain('autoComplete="nickname"');
		expect(initialTargets[0]).toContain('placeholder="How people will see you"');
		expect(markup).toContain('aria-label="Close profile editor"');
	});
});

describe('profile save announcements', () => {
	it('mounts an empty polite status region in the editor before any save phase arrives', () => {
		const markup = renderToStaticMarkup(
			<ProfileEditDialog
				onClose={() => undefined}
				onSave={async () => undefined}
				open
				ownerConnected
				profile={profile}
				restoreTarget={() => null}
			/>
		);
		const dialog = markup.slice(markup.indexOf('role="dialog"'));

		expect(statusRegions(dialog)).toEqual(['']);
		// The visible submit label stays as it was while idle.
		expect(markup).toContain('Save profile</button>');
	});

	it('renders the save phase as status text and nothing when idle', () => {
		expect(statusRegions(renderToStaticMarkup(<ProfileStatusAnnouncement message="Approve picture…" />))).toEqual([
			'Approve picture…',
		]);
		expect(statusRegions(renderToStaticMarkup(<ProfileStatusAnnouncement message={null} />))).toEqual(['']);
	});

	it('keeps a page-level status region mounted for the result after the editor closes', () => {
		const markup = renderToStaticMarkup(
			<MemoryRouter initialEntries={[`/profile/${profile.address}`]}>
				<Routes>
					<Route element={<ProfileRoute />} path="/profile/:address" />
				</Routes>
			</MemoryRouter>
		);

		expect(markup).not.toContain('role="dialog"');
		expect(statusRegions(markup)).toEqual(['']);
	});
});

function renderProfileRoute(address: string) {
	return renderToStaticMarkup(
		<MemoryRouter initialEntries={[`/profile/${address}`]}>
			<Routes>
				<Route element={<ProfileRoute />} path="/profile/:address" />
			</Routes>
		</MemoryRouter>
	);
}

describe('profile load gating', () => {
	// A well-formed 43-character address (the shared fixture address is 42).
	const owner = 'abcdefghijklmno0123456789ABCDEFGHIJKLMNOPQR';
	const visitor = 'zyxwvutsrqponml9876543210ZYXWVUTSRQPONMLKJI';
	const stored = { Owner: owner, DisplayName: 'Alice on Arweave' } as never;
	const connected = wallet.address;
	afterEach(() => {
		wallet.address = connected;
	});

	it('treats a malformed address as invalid: message shown, nothing to retry, nothing to edit', () => {
		expect(
			profileLoadView({ address: 'not-an-address', profile: undefined, readError: '', walletAddress: owner })
		).toEqual({
			status: 'invalid',
			error: INVALID_PROFILE_ADDRESS,
			isLoading: false,
			canEdit: false,
			canRetry: false,
		});
	});

	it('offers no edit to the owner while the profile is still loading', () => {
		expect(profileLoadView({ address: owner, profile: undefined, readError: '', walletAddress: owner })).toEqual({
			status: 'loading',
			error: '',
			isLoading: true,
			canEdit: false,
			canRetry: false,
		});
	});

	it('offers Retry but no edit after the read failed, since the stored name is unknown', () => {
		expect(
			profileLoadView({
				address: owner,
				profile: undefined,
				readError: 'This profile could not be read.',
				walletAddress: owner,
			})
		).toEqual({
			status: 'error',
			error: 'This profile could not be read.',
			isLoading: false,
			canEdit: false,
			canRetry: true,
		});
	});

	it('offers edit only to the owner once the profile has loaded, including an address with no profile yet', () => {
		expect(profileLoadView({ address: owner, profile: stored, readError: '', walletAddress: owner })).toMatchObject(
			{
				status: 'ready',
				canEdit: true,
				canRetry: false,
			}
		);
		expect(profileLoadView({ address: owner, profile: null, readError: '', walletAddress: owner })).toMatchObject({
			status: 'ready',
			canEdit: true,
		});
		expect(
			profileLoadView({ address: owner, profile: stored, readError: '', walletAddress: visitor })
		).toMatchObject({
			status: 'ready',
			canEdit: false,
		});
		expect(profileLoadView({ address: owner, profile: stored, readError: '', walletAddress: null })).toMatchObject({
			canEdit: false,
		});
	});

	it('renders the owner page without edit controls until the profile read lands', () => {
		wallet.address = owner;
		const markup = renderProfileRoute(owner);

		expect(markup).toContain('Resolving this profile from Arweave');
		expect(markup).not.toContain('aria-label="Edit profile"');
		expect(markup).not.toContain('aria-label="Edit profile picture"');
	});

	it('renders the invalid-address message without a Retry that can never succeed', () => {
		const markup = renderProfileRoute('not-an-address');

		expect(markup).toContain(INVALID_PROFILE_ADDRESS);
		expect(markup).not.toContain('Retry');
		expect(markup).not.toContain('Resolving this profile from Arweave');
	});
});

describe('profile editor session', () => {
	const dialog = (ownerConnected: boolean) =>
		renderToStaticMarkup(
			<ProfileEditDialog
				onClose={() => undefined}
				onSave={async () => undefined}
				open
				ownerConnected={ownerConnected}
				profile={profile}
				restoreTarget={() => null}
			/>
		);

	it('starts from the stored name, so an untouched form has nothing to save', () => {
		const markup = dialog(true);
		const nameField = markup.match(/<input\b[^>]*autoComplete="nickname"[^>]*>/)?.[0] ?? '';
		const submit = markup.match(/<button\b[^>]*type="submit"[^>]*>/)?.[0] ?? '';

		expect(nameField).toContain('value="Alice on Arweave"');
		expect(submit).toContain('disabled=""');
	});

	it('does not show the editor once the connected wallet no longer owns the profile', () => {
		expect(dialog(true)).toContain('role="dialog"');
		expect(dialog(false)).toBe('');
	});
});
