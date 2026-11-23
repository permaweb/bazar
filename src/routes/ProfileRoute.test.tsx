import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../app/useDialogFocus', () => ({ useDialogFocus: () => ({ current: null }) }));
vi.mock('./MyAssetsRoute', () => ({ default: () => null }));
const wallet = vi.hoisted(() => ({ address: 'abcdefghijklmno0123456789ABCDEFGHIJKLMNOPQ' as string | null }));
vi.mock('providers/WalletProvider', () => ({ useWallet: () => wallet }));

import ProfileRoute, {
	INVALID_PROFILE_ADDRESS,
	ProfileEditDialog,
	profileLoadView,
	ProfilePage,
	ProfileStatusAnnouncement,
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
