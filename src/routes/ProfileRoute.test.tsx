import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ProfilePage } from './ProfileRoute';

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
});
