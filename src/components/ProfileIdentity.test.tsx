import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import type { AccountProfile } from 'api/profile';

import {
	announceProfileUpdated,
	PROFILE_UPDATED_EVENT,
	ProfileIdentity,
	profilePath,
	profileSummaryFor,
	profileUpdateMatches,
	shortProfileAddress,
	subscribeProfileUpdated,
} from './ProfileIdentity';

const address = 'abcdefghijklmno0123456789ABCDEFGHIJKLMNOPQ';
const other = 'B'.repeat(43);

function accountProfile(owner: string, handle: string, avatar = 'https://example.test/avatar.png'): AccountProfile {
	return { address: owner, transactionId: 'T'.repeat(43), handle, name: '', bio: '', avatar };
}

describe('profileSummaryFor', () => {
	it('shows only the address before any profile has loaded', () => {
		expect(profileSummaryFor(address, undefined)).toEqual({ address });
	});

	it('never pairs an address with a profile loaded for another account', () => {
		expect(profileSummaryFor(other, { address, profile: accountProfile(address, 'Alice') })).toEqual({
			address: other,
		});
	});

	it('shows the name and avatar loaded for the same address', () => {
		expect(profileSummaryFor(address, { address, profile: accountProfile(address, 'Alice') })).toEqual({
			address,
			avatar: 'https://example.test/avatar.png',
			displayName: 'Alice',
		});
	});

	it('shows only the address when the account has no profile', () => {
		expect(profileSummaryFor(address, { address, profile: null })).toEqual({ address });
	});
});

describe('profile updated announcements', () => {
	it('uses the shared bazar:profile-updated event name', () => {
		expect(PROFILE_UPDATED_EVENT).toBe('bazar:profile-updated');
	});

	it('matches only an announcement for the same account that carries a profile', () => {
		const profile = accountProfile(address, 'Alicia');
		const event = (detail: unknown) => new CustomEvent(PROFILE_UPDATED_EVENT, { detail });

		expect(profileUpdateMatches(event({ address, profile }), address)).toBe(true);
		expect(profileUpdateMatches(event({ address, profile }), other)).toBe(false);
		expect(profileUpdateMatches(event({ address }), address)).toBe(false);
		expect(profileUpdateMatches(event(address), address)).toBe(false);
		expect(profileUpdateMatches(new CustomEvent(PROFILE_UPDATED_EVENT), address)).toBe(false);
	});

	it('delivers a saved profile to subscribers for that account until they unsubscribe', () => {
		const target = new EventTarget();
		const onUpdate = vi.fn();
		const unsubscribe = subscribeProfileUpdated(target, address, onUpdate);
		const saved = accountProfile(address, 'Alicia');

		announceProfileUpdated(target, other, accountProfile(other, 'Bob'));
		expect(onUpdate).not.toHaveBeenCalled();

		announceProfileUpdated(target, address, saved);
		expect(onUpdate).toHaveBeenCalledTimes(1);
		expect(onUpdate).toHaveBeenCalledWith(saved);
		expect(profileSummaryFor(address, { address, profile: onUpdate.mock.calls[0][0] }).displayName).toBe('Alicia');

		unsubscribe();
		announceProfileUpdated(target, address, saved);
		expect(onUpdate).toHaveBeenCalledTimes(1);
	});
});

describe('ProfileIdentity', () => {
	it('shows the profile name with a muted short address and links to the shareable route', () => {
		const markup = renderToStaticMarkup(<ProfileIdentity profile={{ address, displayName: 'Alice on Arweave' }} />);

		expect(markup).toContain('Alice on Arweave');
		expect(markup).toContain(`(${shortProfileAddress(address)})`);
		expect(markup).toContain(`href="${profilePath(address)}"`);
		expect(markup).toContain('profile-identity__address');
	});

	it('uses the short address as the entire label when no profile name exists', () => {
		const markup = renderToStaticMarkup(<ProfileIdentity profile={{ address }} showAvatar />);

		expect(markup).toContain(shortProfileAddress(address));
		expect(markup).not.toContain(`(${shortProfileAddress(address)})`);
		expect(markup).toContain('profile-avatar--fallback');
	});
});
