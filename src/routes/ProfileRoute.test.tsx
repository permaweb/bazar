import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../app/useDialogFocus', () => ({ useDialogFocus: () => ({ current: null }) }));
vi.mock('./MyAssetsRoute', () => ({ default: () => null }));
vi.mock('providers/WalletProvider', () => ({
	useWallet: () => ({ address: 'abcdefghijklmno0123456789ABCDEFGHIJKLMNOPQ' }),
}));

import ProfileRoute, { ProfileEditDialog, ProfilePage, ProfileStatusAnnouncement } from './ProfileRoute';

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
