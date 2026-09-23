import { describe, expect, it } from 'vitest';

import { PROFILE_MESSAGES } from 'features/Profile/messages';
import {
	accountProfileNotice,
	type AccountProfileRecord,
	accountProfileSummary,
	profileImageError,
	profileSaveStatus,
	profileUpdateError,
	profileUpdateFields,
} from 'features/Profile/model/profile';
import { appError } from 'helpers/app-error';
import { APP_ERROR_MESSAGES } from 'helpers/app-error.messages';
import { IDLE, LOADING } from 'helpers/async-state';

const ADDRESS = 'abcdefghijklmnop0123456789ABCDEFGHIJKLMNOPQ';
const messages = PROFILE_MESSAGES.en;

function file(type: string, size: number) {
	return new File([new Uint8Array(size)], 'avatar', { type });
}

function profile(overrides: Partial<AccountProfileRecord> = {}): AccountProfileRecord {
	return {
		address: ADDRESS,
		transactionId: 'T'.repeat(43),
		handle: '',
		name: '',
		bio: '',
		avatar: '',
		...overrides,
	};
}

describe('profile update failures', () => {
	it('explains profile-specific reasons and keeps general copy for everything else', () => {
		expect(profileUpdateError(appError('profile-wallet-account-changed'), APP_ERROR_MESSAGES.en)).toBe(
			'The connected wallet changed. Return to your current wallet profile and try again.'
		);
		expect(profileUpdateError(appError('invalid-profile-avatar-size'), APP_ERROR_MESSAGES.en)).toBe(
			'Choose an image smaller than 10 MB.'
		);
		for (const cause of [
			appError('unavailable', { message: 'profile-upload-503' }),
			appError('wallet-request-rejected'),
			new Error('profile-upload-500: gateway exploded'),
		]) {
			expect(profileUpdateError(cause, APP_ERROR_MESSAGES.en)).toBe(
				'Your profile could not be updated. Please try again.'
			);
		}
	});
});

describe('profile picture validation', () => {
	it('accepts supported images up to the size limit', () => {
		expect(profileImageError(file('image/png', 1), APP_ERROR_MESSAGES.en)).toBe('');
		expect(profileImageError(file('image/webp', 10 * 1024 * 1024), APP_ERROR_MESSAGES.en)).toBe('');
	});

	it('rejects unsupported types, empty files, and oversized files', () => {
		expect(profileImageError(file('image/svg+xml', 10), APP_ERROR_MESSAGES.en)).toBe(
			'Choose a PNG, JPEG, WebP, or GIF image.'
		);
		expect(profileImageError(file('image/png', 0), APP_ERROR_MESSAGES.en)).toBe(
			'Choose an image smaller than 10 MB.'
		);
		expect(profileImageError(file('image/gif', 10 * 1024 * 1024 + 1), APP_ERROR_MESSAGES.en)).toBe(
			'Choose an image smaller than 10 MB.'
		);
	});
});

describe('profile update fields', () => {
	const unchanged = { displayName: 'Alice', displayNameChanged: false, avatarFile: null, removeAvatar: false };

	it('sends only the changed name', () => {
		expect(profileUpdateFields(unchanged)).toEqual({});
		expect(profileUpdateFields({ ...unchanged, displayNameChanged: true })).toEqual({ displayName: 'Alice' });
	});

	it('clears a removed picture and prefers a freshly uploaded one', () => {
		expect(profileUpdateFields({ ...unchanged, removeAvatar: true })).toEqual({ avatar: '' });
		expect(profileUpdateFields({ ...unchanged, removeAvatar: true }, 'A'.repeat(43))).toEqual({
			avatar: 'A'.repeat(43),
		});
	});

	it('labels each wallet stage of a save', () => {
		expect(profileSaveStatus('picture', 'signing', messages)).toBe(messages.profileSaveApprovePicture);
		expect(profileSaveStatus('picture', 'uploading', messages)).toBe(messages.profileSaveUploadingPicture);
		expect(profileSaveStatus('profile', 'signing', messages)).toBe(messages.profileSaveApproveProfile);
		expect(profileSaveStatus('profile', 'uploading', messages)).toBe(messages.profileSavePublishingProfile);
	});
});

describe('account profile view model', () => {
	it('falls back to the address when no profile is published', () => {
		expect(accountProfileSummary(ADDRESS, undefined)).toEqual({ address: ADDRESS });
		expect(accountProfileSummary(ADDRESS, null)).toEqual({ address: ADDRESS });
		expect(accountProfileSummary(ADDRESS, profile())).toEqual({ address: ADDRESS });
	});

	it('includes the published name, bio, and a gateway avatar URL', () => {
		const summary = accountProfileSummary(
			ADDRESS,
			profile({ handle: 'alice', name: 'Alice', bio: 'Builder', avatar: 'https://example.com/a.png' })
		);
		expect(summary).toEqual({
			address: ADDRESS,
			displayName: 'alice',
			bio: 'Builder',
			avatar: 'https://example.com/a.png',
		});
	});

	it('distinguishes an invalid address, loading, success, and a failed read', () => {
		expect(accountProfileNotice('not-an-address', IDLE, messages)).toEqual({
			isLoading: false,
			error: messages.profileInvalidAddress,
		});
		expect(accountProfileNotice(ADDRESS, LOADING, messages)).toEqual({ isLoading: true, error: '' });
		expect(accountProfileNotice(ADDRESS, { status: 'success', data: null }, messages)).toEqual({
			isLoading: false,
			error: '',
		});
		expect(accountProfileNotice(ADDRESS, { status: 'error', error: appError('unavailable') }, messages)).toEqual({
			isLoading: false,
			error: messages.profileUnreadable,
		});
	});
});
