import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import ProfileIdentity, {
	profilePath,
	shortProfileAddress,
} from 'components/molecules/ProfileIdentity/ProfileIdentity';
import { PROFILE_IDENTITY_FOR_ADDRESS_MESSAGES } from 'components/organisms/ProfileIdentityForAddress/messages';

const address = 'abcdefghijklmno0123456789ABCDEFGHIJKLMNOPQ';
const label = PROFILE_IDENTITY_FOR_ADDRESS_MESSAGES.en.profileIdentityLabel;

describe('ProfileIdentity', () => {
	it('shows the profile name with a muted short address and links to the shareable route', () => {
		const markup = renderToStaticMarkup(
			<ProfileIdentity label={label} profile={{ address, displayName: 'Alice on Arweave' }} />
		);

		expect(markup).toContain('Alice on Arweave');
		expect(markup).toContain(`(${shortProfileAddress(address)})`);
		expect(markup).toContain(`href="${profilePath(address)}"`);
		expect(markup).toContain('profile-identity__address');
	});

	it('uses the short address as the entire label when no profile name exists', () => {
		const markup = renderToStaticMarkup(<ProfileIdentity label={label} profile={{ address }} showAvatar />);

		expect(markup).toContain(shortProfileAddress(address));
		expect(markup).not.toContain(`(${shortProfileAddress(address)})`);
		expect(markup).toContain('profile-avatar--fallback');
	});
});
