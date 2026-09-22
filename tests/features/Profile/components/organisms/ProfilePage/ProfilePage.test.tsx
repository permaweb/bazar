import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import ProfilePage, { profileUpdateError } from 'features/Profile/components/organisms/ProfilePage/ProfilePage';
import { appError } from 'helpers/app-error';

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

describe('profile update failures', () => {
	it('explains profile-specific reasons and keeps general copy for everything else', () => {
		expect(profileUpdateError(appError('profile-wallet-account-changed'))).toBe(
			'The connected wallet changed. Return to your current wallet profile and try again.'
		);
		expect(profileUpdateError(appError('invalid-profile-avatar-size'))).toBe('Choose an image smaller than 10 MB.');
		for (const cause of [
			appError('unavailable', { message: 'profile-upload-503' }),
			appError('wallet-request-rejected'),
			new Error('profile-upload-500: gateway exploded'),
		]) {
			expect(profileUpdateError(cause)).toBe('Your profile could not be updated. Please try again.');
		}
	});
});
