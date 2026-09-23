import {
	type AccountProfile as AccountProfileRecord,
	PROFILE_AVATAR_CONTENT_TYPES,
	PROFILE_AVATAR_MAX_BYTES,
	profileAvatarUrl,
	profileDisplayName,
	type ProfileUpdate,
} from 'api/profile';

import { type AppErrorMessages, type AppErrorReason, appErrorReasonMessage, toAppError } from 'helpers/app-error';
import { isArweaveId } from 'helpers/arweave-id';
import { type AsyncState } from 'helpers/async-state';
import type { ProfileSummary } from 'types/profile';

import type { ProfileMessages } from '../messages';

export type { AccountProfileRecord };

/** A read profile: `null` when the address has not published one. */
export type AccountProfileState = AsyncState<AccountProfileRecord | null>;

export type ProfileEditUpdate = {
	displayName: string;
	displayNameChanged: boolean;
	avatarFile: File | null;
	removeAvatar: boolean;
};

/** The two uploads a profile save can sign: an optional picture, then the profile document. */
export type ProfileSaveStage = 'picture' | 'profile';
export type ProfileUploadPhase = 'signing' | 'uploading';

export function profileImageError(file: File, errorMessages: AppErrorMessages): string {
	if (!PROFILE_AVATAR_CONTENT_TYPES.includes(file.type)) {
		return appErrorReasonMessage(errorMessages, 'invalid-profile-avatar-type');
	}
	if (!file.size || file.size > PROFILE_AVATAR_MAX_BYTES) {
		return appErrorReasonMessage(errorMessages, 'invalid-profile-avatar-size');
	}
	return '';
}

/** Failures a profile update explains specifically; every other failure keeps the general profile copy. */
const PROFILE_UPDATE_FAILURES = new Set<AppErrorReason>([
	'invalid-profile-avatar',
	'invalid-profile-avatar-type',
	'invalid-profile-avatar-size',
	'profile-wallet-account-changed',
]);

export function profileUpdateError(cause: unknown, errorMessages: AppErrorMessages): string {
	const { reason } = toAppError(cause, 'profile-update-failed');
	return appErrorReasonMessage(errorMessages, PROFILE_UPDATE_FAILURES.has(reason) ? reason : 'profile-update-failed');
}

/**
 * The patch a profile save publishes: the name only when it changed, and the picture as the freshly uploaded
 * avatar, an explicit removal, or untouched.
 */
export function profileUpdateFields(update: ProfileEditUpdate, uploadedAvatar?: string): ProfileUpdate {
	return {
		...(update.displayNameChanged ? { displayName: update.displayName } : {}),
		...(uploadedAvatar !== undefined ? { avatar: uploadedAvatar } : update.removeAvatar ? { avatar: '' } : {}),
	};
}

export function profileSaveStatus(
	stage: ProfileSaveStage,
	phase: ProfileUploadPhase,
	messages: ProfileMessages
): string {
	if (stage === 'picture') {
		return phase === 'signing' ? messages.profileSaveApprovePicture : messages.profileSaveUploadingPicture;
	}
	return phase === 'signing' ? messages.profileSaveApproveProfile : messages.profileSavePublishingProfile;
}

/** Display-ready identity for a profile page, falling back to the bare address while nothing is published. */
export function accountProfileSummary(
	address: string,
	profile: AccountProfileRecord | null | undefined
): ProfileSummary {
	const displayName = profileDisplayName(profile);
	const avatar = profileAvatarUrl(profile);
	return {
		address,
		...(displayName ? { displayName } : {}),
		...(profile?.bio ? { bio: profile.bio } : {}),
		...(avatar ? { avatar } : {}),
	};
}

/** The loading and failure notice a profile page shows for an address and its read state. */
export function accountProfileNotice(
	address: string,
	state: AccountProfileState,
	messages: ProfileMessages
): { isLoading: boolean; error: string } {
	if (!isArweaveId(address)) return { isLoading: false, error: messages.profileInvalidAddress };
	if (state.status === 'error' || state.status === 'stale') {
		return { isLoading: false, error: messages.profileUnreadable };
	}
	return { isLoading: state.status === 'loading' || state.status === 'idle', error: '' };
}
